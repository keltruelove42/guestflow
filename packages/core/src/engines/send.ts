import { prisma } from "@guestflow/db";
import { getEmailSender, getSmsSender } from "../integrations";
import { renderMessage } from "../messaging/render";
import { checkTrialSendAllowed } from "../org/trial";

/**
 * Lightweight per-lead delivery for lead engines (review requests, reactivation).
 * Unlike a manual reply it does NOT pause the lead's active sequences or bump
 * their stage — a review ask or reactivation nudge shouldn't disrupt automation.
 * Honors consent + trial send limits + email verification.
 */
export type DeliverResult = { sent: boolean; reason?: string; channel?: "EMAIL" | "SMS" };

export async function deliverToLead(opts: {
  orgId: string;
  leadId: string;
  channel: "EMAIL" | "SMS";
  subject?: string | null;
  body: string;
  eventType:
    | "REVIEW_REQUESTED"
    | "REACTIVATED"
    | "SMS_SENT"
    | "EMAIL_SENT";
  eventTitle: string;
  /** Extra fields merged into the LeadEvent.meta (e.g. emergency override audit). */
  metaExtra?: Record<string, unknown>;
  now?: Date;
}): Promise<DeliverResult> {
  const now = opts.now ?? new Date();
  const lead = await prisma.lead.findFirst({
    where: { id: opts.leadId, orgId: opts.orgId },
    include: {
      property: true,
      org: {
        include: {
          users: { take: 1, orderBy: { createdAt: "asc" }, select: { name: true, emailVerifiedAt: true } },
          brandSettings: true,
        },
      },
    },
  });
  if (!lead) return { sent: false, reason: "Lead not found" };

  // Consent gate.
  if (opts.channel === "EMAIL") {
    if (!lead.email || !lead.emailConsent || lead.unsubscribedAt) {
      return { sent: false, reason: "No email consent" };
    }
  } else {
    if (!lead.phone || !lead.smsConsent || lead.smsStoppedAt) {
      return { sent: false, reason: "No SMS consent" };
    }
  }

  // Trial send gate.
  const gate = await checkTrialSendAllowed(
    {
      id: lead.orgId,
      plan: lead.org.plan,
      mode: lead.org.mode,
      trialEndsAt: lead.org.trialEndsAt,
      ownerEmailVerified: lead.org.users[0]?.emailVerifiedAt != null,
    },
    opts.channel,
    now,
  );
  if (!gate.allowed) return { sent: false, reason: gate.reason };

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const orgVars =
    lead.org.variables && typeof lead.org.variables === "object" && !Array.isArray(lead.org.variables)
      ? (lead.org.variables as Record<string, string>)
      : null;

  const rendered = renderMessage({
    template: opts.body,
    subject: opts.subject ?? null,
    channel: opts.channel,
    leadName: lead.name,
    propertyName: lead.property?.name,
    hostName: lead.org.users[0]?.name ?? undefined,
    unsubLink: `${appUrl}/api/v1/unsubscribe?leadId=${lead.id}`,
    orgVariables: orgVars,
    brand: lead.org.brandSettings,
    now,
    appUrl,
  });

  let providerId = "";
  try {
    if (opts.channel === "EMAIL") {
      const sender = await getEmailSender(lead.orgId);
      const r = await sender.send({
        to: lead.email!,
        subject: rendered.subject ?? opts.subject ?? "A quick note",
        html: rendered.html ?? rendered.body,
        text: rendered.body,
        replyTo: `reply+${lead.id}@mail.localhost`,
      });
      providerId = r.providerId;
    } else {
      const sender = await getSmsSender(lead.orgId);
      const r = await sender.send({ to: lead.phone!, body: rendered.body });
      providerId = r.providerId;
    }
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : "Send failed" };
  }

  await prisma.leadEvent.create({
    data: {
      orgId: lead.orgId,
      leadId: lead.id,
      type: opts.eventType,
      channel: opts.channel,
      title: opts.eventTitle,
      body: rendered.body,
      occurredAt: now,
      meta: { providerId, ...(opts.metaExtra ?? {}) },
    },
  });

  return { sent: true, channel: opts.channel };
}

/** Pick the best consented channel for a lead (SMS preferred, then email). */
export function bestChannel(lead: {
  phone: string | null;
  email: string | null;
  smsConsent: boolean;
  emailConsent: boolean;
  smsStoppedAt: Date | null;
  unsubscribedAt: Date | null;
}): "EMAIL" | "SMS" | null {
  if (lead.phone && lead.smsConsent && !lead.smsStoppedAt) return "SMS";
  if (lead.email && lead.emailConsent && !lead.unsubscribedAt) return "EMAIL";
  return null;
}
