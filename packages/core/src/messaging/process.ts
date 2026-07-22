import { prisma } from "@guestflow/db";
import { getEmailSender, getSmsSender } from "../integrations";
import { resolveChannel, rewriteForFallback } from "./resolveChannel";
import { shouldDeferForQuietHours } from "./quietHours";
import { renderMessage } from "./render";

export type ProcessResult =
  | { status: "SENT"; channel: "EMAIL" | "SMS" | "CALL" }
  | { status: "SKIPPED"; reason: string }
  | { status: "DEFERRED"; sendAt: Date }
  | { status: "HELD"; reason: string }
  | { status: "ALREADY_DONE" };

/**
 * Process one scheduled message through all send-time guards.
 * Idempotent via ScheduledMessage.status + idempotencyKey.
 */
export async function processScheduledMessage(
  scheduledId: string,
  opts?: { now?: Date; force?: boolean },
): Promise<ProcessResult> {
  const now = opts?.now ?? new Date();

  const msg = await prisma.scheduledMessage.findUnique({
    where: { id: scheduledId },
    include: {
      enrollment: {
        include: {
          sequence: { include: { steps: { orderBy: { order: "asc" } } } },
          lead: {
            include: {
              property: true,
              org: { include: { users: { take: 1, orderBy: { createdAt: "asc" } } } },
            },
          },
        },
      },
    },
  });

  if (!msg) return { status: "ALREADY_DONE" };
  if (msg.status !== "PENDING") return { status: "ALREADY_DONE" };
  if (!opts?.force && msg.sendAt > now) {
    return { status: "HELD", reason: "Not due yet" };
  }

  await prisma.scheduledMessage.update({
    where: { id: msg.id },
    data: { attempts: { increment: 1 } },
  });

  const { enrollment } = msg;
  const lead = enrollment.lead;
  const org = lead.org;
  const sequence = enrollment.sequence;
  const step = sequence.steps.find((s) => s.id === msg.stepId);

  if (enrollment.status !== "ACTIVE") {
    return { status: "HELD", reason: `Enrollment ${enrollment.status}` };
  }

  if (!sequence.active) {
    return { status: "HELD", reason: "Sequence paused" };
  }

  if (lead.stage === "BOOKED" || lead.stage === "LOST") {
    await prisma.scheduledMessage.updateMany({
      where: { id: msg.id, status: "PENDING" },
      data: { status: "CANCELED" },
    });
    return { status: "SKIPPED", reason: `Lead is ${lead.stage}` };
  }

  if (!step) {
    await prisma.scheduledMessage.updateMany({
      where: { id: msg.id, status: "PENDING" },
      data: { status: "FAILED", lastError: "Step missing" },
    });
    return { status: "SKIPPED", reason: "Step missing" };
  }

  // Guard 5: quiet hours (before channel — defer keeps PENDING)
  // DECISION: DEMO mode skips quiet hours so pitch/simulator works evenings
  const quiet =
    org.mode === "DEMO"
      ? ({ defer: false } as const)
      : shouldDeferForQuietHours({
          now,
          quietStart: org.quietStart,
          quietEnd: org.quietEnd,
          timeZone: org.timezone,
        });
  if (quiet.defer) {
    await prisma.scheduledMessage.update({
      where: { id: msg.id },
      data: { sendAt: quiet.sendAt },
    });
    return { status: "DEFERRED", sendAt: quiet.sendAt };
  }

  const resolution = resolveChannel(step.channel, lead);
  if (resolution.action === "SKIP") {
    const skipped = await prisma.scheduledMessage.updateMany({
      where: { id: msg.id, status: "PENDING" },
      data: { status: "SKIPPED" },
    });
    if (skipped.count === 0) return { status: "ALREADY_DONE" };

    await prisma.leadEvent.create({
      data: {
        orgId: lead.orgId,
        leadId: lead.id,
        type: "EMAIL_SCHEDULED_SKIPPED",
        title: "Step skipped - no channel available",
        body: resolution.reason,
        occurredAt: now,
        meta: { scheduledId: msg.id, stepId: step.id },
      },
    });
    await advanceEnrollment(enrollment.id, sequence.id, now);
    return { status: "SKIPPED", reason: resolution.reason };
  }

  const propertyName = lead.property?.name ?? "our place";
  let subject = step.subject;
  let body = step.body;
  if (resolution.fallbackFrom) {
    const rewritten = rewriteForFallback({
      from: resolution.fallbackFrom,
      to: resolution.channel,
      subject,
      body,
      propertyName,
    });
    subject = rewritten.subject;
    body = rewritten.body;
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const unsubLink = `${appUrl}/api/v1/unsubscribe?leadId=${lead.id}`;
  const hostName = org.users[0]?.name ?? "Taylor";

  const rendered = renderMessage({
    template: body,
    subject,
    channel: resolution.channel,
    leadName: lead.name,
    propertyName,
    hostName,
    travelDates: lead.travelDates,
    quoteLink: lead.property?.directBookingUrl,
    unsubLink,
    now,
    appUrl,
  });

  let providerId: string | null = null;
  let delivery: "live" | "log" | null = null;

  try {
    if (resolution.channel === "CALL") {
      // Call steps are host tasks: flag attention, no outbound provider
      await prisma.lead.update({
        where: { id: lead.id },
        data: { needsAttention: true },
      });
    } else if (resolution.channel === "EMAIL") {
      if (!lead.email || !lead.emailConsent || lead.unsubscribedAt) {
        throw new Error("Email consent missing");
      }
      const sender = await getEmailSender(lead.orgId);
      delivery =
        sender.constructor.name === "ResendEmailSender" ? "live" : "log";
      const result = await sender.send({
        to: lead.email,
        subject: rendered.subject ?? "A note from your host",
        html: rendered.html ?? rendered.body,
        text: rendered.body,
        replyTo: `reply+${lead.id}@mail.localhost`,
        headers: { "List-Unsubscribe": `<${unsubLink}>` },
      });
      providerId = result.providerId;
    } else {
      if (!lead.phone || !lead.smsConsent || lead.smsStoppedAt) {
        throw new Error("SMS consent missing");
      }
      const sender = await getSmsSender(lead.orgId);
      delivery =
        sender.constructor.name === "TwilioSmsSender" ? "live" : "log";
      const result = await sender.send({ to: lead.phone, body: rendered.body });
      providerId = result.providerId;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    await prisma.scheduledMessage.updateMany({
      where: { id: msg.id, status: "PENDING" },
      data: { status: "FAILED", lastError: message },
    });
    return { status: "SKIPPED", reason: message };
  }

  const sent = await prisma.scheduledMessage.updateMany({
    where: { id: msg.id, status: "PENDING" },
    data: { status: "SENT", sentAt: now },
  });
  if (sent.count === 0) return { status: "ALREADY_DONE" };

  const eventType =
    resolution.channel === "EMAIL"
      ? "EMAIL_SENT"
      : resolution.channel === "SMS"
        ? "SMS_SENT"
        : "CALL_DUE";
  const eventTitle =
    resolution.channel === "EMAIL"
      ? `Email sent - "${rendered.subject}"`
      : resolution.channel === "SMS"
        ? "SMS sent"
        : `Call due - ${lead.phone}`;

  await prisma.leadEvent.create({
    data: {
      orgId: lead.orgId,
      leadId: lead.id,
      type: eventType,
      channel: resolution.channel,
      title: eventTitle,
      body: rendered.body,
      occurredAt: now,
      meta: {
        scheduledId: msg.id,
        stepId: step.id,
        idempotencyKey: msg.idempotencyKey,
        fallbackFrom: resolution.fallbackFrom,
        providerId,
        delivery,
      },
    },
  });

  if (lead.stage === "NEW") {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { stage: "CONTACTED" },
    });
    await prisma.leadEvent.create({
      data: {
        orgId: lead.orgId,
        leadId: lead.id,
        type: "STAGE_CHANGED",
        title: "Stage → Contacted",
        body: "First automated touch",
        occurredAt: now,
      },
    });
  }

  await advanceEnrollment(enrollment.id, sequence.id, now);
  return { status: "SENT", channel: resolution.channel };
}

async function advanceEnrollment(
  enrollmentId: string,
  sequenceId: string,
  now: Date,
) {
  const enrollment = await prisma.enrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
  });
  const sequence = await prisma.sequence.findUniqueOrThrow({
    where: { id: sequenceId },
    include: { steps: { orderBy: { order: "asc" } } },
  });

  const nextStepIndex = enrollment.currentStep + 1;
  const nextStep = sequence.steps[nextStepIndex];

  if (!nextStep) {
    await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        status: "COMPLETED",
        currentStep: nextStepIndex,
        completedAt: now,
      },
    });
    await prisma.leadEvent.create({
      data: {
        orgId: enrollment.orgId,
        leadId: enrollment.leadId,
        type: "SEQUENCE_COMPLETED",
        title: `Sequence completed: “${sequence.name}”`,
        occurredAt: now,
        meta: { enrollmentId, sequenceId },
      },
    });
    return;
  }

  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { currentStep: nextStepIndex },
  });

  const sendAt = new Date(now.getTime() + nextStep.delayMinutes * 60_000);
  await prisma.scheduledMessage.upsert({
    where: { idempotencyKey: `${enrollmentId}:${nextStep.id}` },
    create: {
      orgId: enrollment.orgId,
      enrollmentId,
      stepId: nextStep.id,
      channel: nextStep.channel,
      sendAt,
      status: "PENDING",
      idempotencyKey: `${enrollmentId}:${nextStep.id}`,
    },
    update: {},
  });
}
