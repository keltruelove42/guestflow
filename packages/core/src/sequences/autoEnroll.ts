import { prisma, type SequenceTrigger, type Lead, type Prisma } from "@guestflow/db";
import { processScheduledMessage } from "../messaging/process";

export type AutoEnrollResult =
  | { enrolled: true; enrollmentId: string; sequenceId: string }
  | { enrolled: false; reason: string };

/**
 * Find active sequences for trigger and enroll the lead.
 * Campaign autoEnrollSequenceId wins for AD_LEAD_CAPTURED.
 */
export async function autoEnroll(
  leadId: string,
  trigger: SequenceTrigger,
  opts?: { now?: Date; processInstant?: boolean },
): Promise<AutoEnrollResult> {
  const now = opts?.now ?? new Date();
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { campaign: true },
  });

  // DECISION: CHECKOUT_PLUS_90D may enroll BOOKED past guests; LOST still blocked for all triggers
  if (lead.stage === "LOST") {
    return { enrolled: false, reason: `Lead stage is ${lead.stage}` };
  }
  if (lead.stage === "BOOKED" && trigger !== "CHECKOUT_PLUS_90D") {
    return { enrolled: false, reason: `Lead stage is ${lead.stage}` };
  }

  let sequenceId: string | null = null;

  if (
    trigger === "AD_LEAD_CAPTURED" &&
    lead.campaign?.autoEnrollSequenceId
  ) {
    const override = await prisma.sequence.findFirst({
      where: {
        id: lead.campaign.autoEnrollSequenceId,
        orgId: lead.orgId,
        active: true,
      },
    });
    if (override) sequenceId = override.id;
  }

  if (!sequenceId) {
    const seq = await prisma.sequence.findFirst({
      where: { orgId: lead.orgId, trigger, active: true },
      orderBy: { createdAt: "asc" },
    });
    if (!seq) return { enrolled: false, reason: "No active sequence for trigger" };
    sequenceId = seq.id;
  }

  const existing = await prisma.enrollment.findFirst({
    where: {
      leadId: lead.id,
      sequenceId,
      status: { in: ["ACTIVE", "PAUSED"] },
    },
  });
  if (existing) {
    return { enrolled: false, reason: "Already enrolled in this sequence" };
  }

  const sequence = await prisma.sequence.findUniqueOrThrow({
    where: { id: sequenceId },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  const step0 = sequence.steps[0];
  if (!step0) return { enrolled: false, reason: "Sequence has no steps" };

  const enrollment = await prisma.enrollment.create({
    data: {
      orgId: lead.orgId,
      leadId: lead.id,
      sequenceId,
      status: "ACTIVE",
      currentStep: 0,
      createdAt: now,
    },
  });

  await prisma.leadEvent.create({
    data: {
      orgId: lead.orgId,
      leadId: lead.id,
      type: "ENROLLED",
      title: `Enrolled in “${sequence.name}”`,
      body: `Trigger: ${trigger}`,
      meta: { sequenceId, enrollmentId: enrollment.id, trigger },
      occurredAt: now,
    },
  });

  const sendAt = new Date(now.getTime() + step0.delayMinutes * 60_000);
  const scheduled = await prisma.scheduledMessage.create({
    data: {
      orgId: lead.orgId,
      enrollmentId: enrollment.id,
      stepId: step0.id,
      channel: step0.channel,
      sendAt,
      status: "PENDING",
      idempotencyKey: `${enrollment.id}:${step0.id}`,
    },
  });

  // Instant steps: process inline for "welcome email" feel
  if (step0.delayMinutes === 0 && opts?.processInstant !== false) {
    await processScheduledMessage(scheduled.id, { now });
  }

  return { enrolled: true, enrollmentId: enrollment.id, sequenceId };
}

export async function pauseEnrollment(
  enrollmentId: string,
  reason: string,
  opts?: { now?: Date },
) {
  const now = opts?.now ?? new Date();
  const enrollment = await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { status: "PAUSED", pausedReason: reason },
  });
  await prisma.leadEvent.create({
    data: {
      orgId: enrollment.orgId,
      leadId: enrollment.leadId,
      type: "SEQUENCE_PAUSED",
      title: "Sequence paused",
      body: reason,
      occurredAt: now,
      meta: { enrollmentId },
    },
  });
  return enrollment;
}

export async function resumeEnrollment(
  enrollmentId: string,
  opts?: { now?: Date },
) {
  const now = opts?.now ?? new Date();
  const enrollment = await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { status: "ACTIVE", pausedReason: null },
  });
  // Don't dogpile: push pending sendAt to at least now+1h
  const minSend = new Date(now.getTime() + 60 * 60_000);
  await prisma.scheduledMessage.updateMany({
    where: { enrollmentId, status: "PENDING", sendAt: { lt: minSend } },
    data: { sendAt: minSend },
  });
  return enrollment;
}

export async function stopEnrollment(
  enrollmentId: string,
  reason: string,
  opts?: { now?: Date },
) {
  const now = opts?.now ?? new Date();
  const enrollment = await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { status: "STOPPED", completedAt: now, pausedReason: reason },
  });
  await prisma.scheduledMessage.updateMany({
    where: { enrollmentId, status: "PENDING" },
    data: { status: "CANCELED" },
  });
  await prisma.leadEvent.create({
    data: {
      orgId: enrollment.orgId,
      leadId: enrollment.leadId,
      type: "SEQUENCE_STOPPED",
      title: "Sequence stopped",
      body: reason,
      occurredAt: now,
      meta: { enrollmentId },
    },
  });
  return enrollment;
}

/** Pause all active enrollments for a lead (reply / manual send). */
export async function pauseActiveEnrollments(
  leadId: string,
  reason: string,
  opts?: { now?: Date },
) {
  const active = await prisma.enrollment.findMany({
    where: { leadId, status: "ACTIVE" },
  });
  for (const e of active) {
    await pauseEnrollment(e.id, reason, opts);
  }
  await prisma.lead.update({
    where: { id: leadId },
    data: { needsAttention: true },
  });
  return active.length;
}

/** Stop all active/paused enrollments — BOOKED / LOST. */
export async function stopActiveEnrollments(
  leadId: string,
  reason: string,
  opts?: { now?: Date },
) {
  const open = await prisma.enrollment.findMany({
    where: { leadId, status: { in: ["ACTIVE", "PAUSED"] } },
  });
  for (const e of open) {
    await stopEnrollment(e.id, reason, opts);
  }
  return open.length;
}

/**
 * Enroll a lead in a specific sequence, chosen by a human (e.g. after a CSV
 * import). Same guardrails as autoEnroll: LOST leads blocked, no duplicate
 * active/paused enrollment, step 0 scheduled (instant steps process inline).
 */
export async function manualEnroll(
  leadId: string,
  sequenceId: string,
  opts?: { now?: Date; processInstant?: boolean },
): Promise<AutoEnrollResult> {
  const now = opts?.now ?? new Date();
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });

  if (lead.stage === "LOST") {
    return { enrolled: false, reason: "Lead stage is LOST" };
  }

  const sequence = await prisma.sequence.findFirst({
    where: { id: sequenceId, orgId: lead.orgId, active: true },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  if (!sequence) return { enrolled: false, reason: "Sequence not found or inactive" };

  const step0 = sequence.steps[0];
  if (!step0) return { enrolled: false, reason: "Sequence has no steps" };

  const existing = await prisma.enrollment.findFirst({
    where: {
      leadId: lead.id,
      sequenceId: sequence.id,
      status: { in: ["ACTIVE", "PAUSED"] },
    },
  });
  if (existing) {
    return { enrolled: false, reason: "Already enrolled in this sequence" };
  }

  const enrollment = await prisma.enrollment.create({
    data: {
      orgId: lead.orgId,
      leadId: lead.id,
      sequenceId: sequence.id,
      status: "ACTIVE",
      currentStep: 0,
      createdAt: now,
    },
  });

  await prisma.leadEvent.create({
    data: {
      orgId: lead.orgId,
      leadId: lead.id,
      type: "ENROLLED",
      title: `Enrolled in “${sequence.name}”`,
      body: "Enrolled manually",
      meta: { sequenceId: sequence.id, enrollmentId: enrollment.id, manual: true },
      occurredAt: now,
    },
  });

  const sendAt = new Date(now.getTime() + step0.delayMinutes * 60_000);
  const scheduled = await prisma.scheduledMessage.create({
    data: {
      orgId: lead.orgId,
      enrollmentId: enrollment.id,
      stepId: step0.id,
      channel: step0.channel,
      sendAt,
      status: "PENDING",
      idempotencyKey: `${enrollment.id}:${step0.id}`,
    },
  });

  if (step0.delayMinutes === 0 && opts?.processInstant !== false) {
    await processScheduledMessage(scheduled.id, { now });
  }

  return { enrolled: true, enrollmentId: enrollment.id, sequenceId: sequence.id };
}

export type LeadForEnroll = Lead;
export type { Prisma };
