import { prisma } from "@guestflow/db";
import { getEmailSender, getSmsSender } from "../integrations";
import { pauseActiveEnrollments } from "../sequences/autoEnroll";
import { renderMessage } from "./render";

export type SendManualInput = {
  orgId: string;
  leadId: string;
  channel: "EMAIL" | "SMS";
  subject?: string | null;
  body: string;
  viaAi?: boolean;
  now?: Date;
};

export type SendManualResult = {
  eventId: string;
  channel: "EMAIL" | "SMS";
  providerId: string;
  delivery: "live" | "log";
};

/**
 * Manual or AI compose send. Consent checked at send time; pauses active enrollments.
 */
export async function sendManualMessage(
  input: SendManualInput,
): Promise<SendManualResult> {
  const now = input.now ?? new Date();

  const lead = await prisma.lead.findFirst({
    where: { id: input.leadId, orgId: input.orgId },
    include: {
      property: true,
      org: { include: { users: { take: 1, orderBy: { createdAt: "asc" } } } },
    },
  });
  if (!lead) throw new Error("Lead not found");

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const unsubLink = `${appUrl}/api/v1/unsubscribe?leadId=${lead.id}`;
  const hostName = lead.org.users[0]?.name ?? "Taylor";

  const rendered = renderMessage({
    template: input.body,
    subject: input.subject ?? null,
    channel: input.channel,
    leadName: lead.name,
    propertyName: lead.property?.name,
    hostName,
    travelDates: lead.travelDates,
    quoteLink: lead.property?.directBookingUrl,
    unsubLink,
    now,
    appUrl,
  });

  let providerId: string;
  let delivery: "live" | "log" = "log";

  if (input.channel === "EMAIL") {
    if (!lead.email) throw new Error("Lead has no email");
    if (!lead.emailConsent || lead.unsubscribedAt) {
      throw new Error("No email consent");
    }
    const sender = await getEmailSender(lead.orgId);
    delivery = sender.constructor.name === "ResendEmailSender" ? "live" : "log";
    const result = await sender.send({
      to: lead.email,
      subject: rendered.subject ?? input.subject ?? "A note from your host",
      html: rendered.html ?? rendered.body,
      text: rendered.body,
      replyTo: `reply+${lead.id}@mail.localhost`,
      headers: {
        "List-Unsubscribe": `<${unsubLink}>`,
      },
    });
    providerId = result.providerId;
  } else {
    if (!lead.phone) throw new Error("Lead has no phone");
    if (!lead.smsConsent || lead.smsStoppedAt) {
      throw new Error("No SMS consent");
    }
    const sender = await getSmsSender(lead.orgId);
    delivery = sender.constructor.name === "TwilioSmsSender" ? "live" : "log";
    const result = await sender.send({ to: lead.phone, body: rendered.body });
    providerId = result.providerId;
  }

  await pauseActiveEnrollments(lead.id, "Manual send", { now });

  const eventType = input.viaAi ? "AI_REPLY_SENT" : "MANUAL_MESSAGE";
  const channelLabel = input.channel === "EMAIL" ? "Email" : "SMS";
  const title = input.viaAi
    ? `AI ${channelLabel.toLowerCase()} sent`
    : `${channelLabel} sent manually`;

  const event = await prisma.leadEvent.create({
    data: {
      orgId: lead.orgId,
      leadId: lead.id,
      type: eventType,
      channel: input.channel,
      title,
      body: rendered.body,
      occurredAt: now,
      meta: {
        providerId,
        delivery,
        subject: rendered.subject,
        viaAi: Boolean(input.viaAi),
      },
    },
  });

  if (lead.stage === "NEW") {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { stage: "CONTACTED", needsAttention: true },
    });
    await prisma.leadEvent.create({
      data: {
        orgId: lead.orgId,
        leadId: lead.id,
        type: "STAGE_CHANGED",
        title: "Stage → Contacted",
        body: "Manual message",
        occurredAt: now,
      },
    });
  } else {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { needsAttention: true },
    });
  }

  return {
    eventId: event.id,
    channel: input.channel,
    providerId,
    delivery,
  };
}
