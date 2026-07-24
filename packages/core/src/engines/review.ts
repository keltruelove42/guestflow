import { prisma } from "@guestflow/db";
import { bestChannel, deliverToLead } from "./send";

/**
 * Review flywheel. After a booking, ask the customer for a review with a
 * tracked link ({APP_URL}/r/{leadId} → logs the click → redirects to the
 * business's Google/Airbnb review URL). Review volume compounds into higher
 * local ranking and more free inbound.
 */

const DEFAULT_REVIEW_MESSAGE =
  "Thanks for choosing {{business_name}}, {{first_name}}! A quick review means the world to a small business — it takes 20 seconds: {{review_link}}";

export type ReviewResult = { sent: boolean; reason?: string; channel?: "EMAIL" | "SMS" };

export async function sendReviewRequest(
  orgId: string,
  leadId: string,
  now: Date = new Date(),
): Promise<ReviewResult> {
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { reviewUrl: true, reviewMessage: true },
  });
  if (!org?.reviewUrl) return { sent: false, reason: "No review link set" };

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, orgId },
    select: {
      phone: true,
      email: true,
      smsConsent: true,
      emailConsent: true,
      smsStoppedAt: true,
      unsubscribedAt: true,
    },
  });
  if (!lead) return { sent: false, reason: "Lead not found" };

  const channel = bestChannel(lead);
  if (!channel) return { sent: false, reason: "No consented channel" };

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  // The review_link merge tag resolves to the tracked redirect.
  const body = (org.reviewMessage?.trim() || DEFAULT_REVIEW_MESSAGE).replace(
    "{{review_link}}",
    `${appUrl}/r/${leadId}`,
  );

  const r = await deliverToLead({
    orgId,
    leadId,
    channel,
    subject: channel === "EMAIL" ? "How did we do?" : null,
    body,
    eventType: "REVIEW_REQUESTED",
    eventTitle: "Review request sent",
    now,
  });
  return { sent: r.sent, reason: r.reason, channel: r.channel };
}

/** Log a review-link click and return the destination to redirect to. */
export async function recordReviewClick(leadId: string): Promise<string | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { orgId: true, org: { select: { reviewUrl: true } } },
  });
  if (!lead?.org.reviewUrl) return null;
  await prisma.leadEvent.create({
    data: {
      orgId: lead.orgId,
      leadId,
      type: "REVIEW_CLICKED",
      title: "Clicked review link",
      occurredAt: new Date(),
    },
  });
  return lead.org.reviewUrl;
}
