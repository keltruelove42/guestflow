import { prisma } from "@guestflow/db";
import { getSmsSender } from "../integrations";
import { readIntegrationCredentials } from "../integrations/verify";
import { renderMessage } from "../messaging/render";
import { checkTrialSendAllowed } from "../org/trial";

/**
 * Missed-call text-back. When a call to a business's number goes unanswered,
 * we instantly text the caller so the lead isn't lost — and the AI reply agent
 * (via recordInbound) takes over when they reply. Attacks the ~74% of home-
 * service calls that go unanswered, and improves Google LSA responsiveness.
 */

const DEFAULT_TEXTBACK =
  "Hi{{first_name_sp}}, sorry we missed your call at {{business_name}}! " +
  "Reply here and we'll help you right away.";

export function last10(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "").slice(-10);
}

/** Resolve which org owns an inbound phone number (Twilio or managed SMS). */
export async function orgIdForNumber(toNumber: string): Promise<string | null> {
  const toDigits = last10(toNumber);
  if (!toDigits) return null;
  const rows = await prisma.integration.findMany({
    where: { provider: { in: ["twilio", "managed_sms"] }, status: "CONNECTED" },
    select: { orgId: true, credentials: true },
  });
  for (const row of rows) {
    const creds = readIntegrationCredentials(row.credentials) as { fromNumber?: string } | null;
    if (last10(creds?.fromNumber) === toDigits) return row.orgId;
  }
  return null;
}

/** Find an existing lead by phone in an org, else create one (source PHONE). */
async function findOrCreateCaller(orgId: string, fromNumber: string, now: Date) {
  const fromDigits = last10(fromNumber);
  const candidates = await prisma.lead.findMany({
    where: { orgId, phone: { contains: fromDigits.slice(-4) } },
    orderBy: { updatedAt: "desc" },
    take: 25,
  });
  const existing = candidates.find((l) => last10(l.phone) === fromDigits);
  if (existing) return { lead: existing, created: false };

  // Calling the business is implied consent to be texted a response back.
  const lead = await prisma.lead.create({
    data: {
      orgId,
      name: `Caller ${fromNumber.slice(-4)}`,
      phone: fromNumber,
      source: "PHONE",
      stage: "NEW",
      smsConsent: true,
      smsConsentAt: now,
      needsAttention: true,
    },
  });
  return { lead, created: true };
}

export type MissedCallResult =
  | { texted: true; leadId: string }
  | { texted: false; reason: string };

/**
 * Handle an unanswered call: find/create the caller as a lead and text them
 * back. Sends immediately (skips quiet hours — it's a live response to their
 * call) but honors trial send limits.
 */
export async function handleMissedCall(opts: {
  orgId: string;
  from: string;
  now?: Date;
}): Promise<MissedCallResult> {
  const now = opts.now ?? new Date();
  if (!last10(opts.from)) return { texted: false, reason: "No caller number" };

  const org = await prisma.org.findUnique({
    where: { id: opts.orgId },
    select: {
      plan: true,
      mode: true,
      trialEndsAt: true,
      missedCallEnabled: true,
      missedCallText: true,
      variables: true,
      users: { take: 1, orderBy: { createdAt: "asc" }, select: { name: true, emailVerifiedAt: true } },
    },
  });
  if (!org?.missedCallEnabled) return { texted: false, reason: "Missed-call text-back is off" };

  const gate = await checkTrialSendAllowed(
    {
      id: opts.orgId,
      plan: org.plan,
      mode: org.mode,
      trialEndsAt: org.trialEndsAt,
      ownerEmailVerified: org.users[0]?.emailVerifiedAt != null,
    },
    "SMS",
    now,
  );
  if (!gate.allowed) return { texted: false, reason: gate.reason };

  const { lead } = await findOrCreateCaller(opts.orgId, opts.from, now);

  // Record the missed call on the timeline.
  await prisma.leadEvent.create({
    data: {
      orgId: opts.orgId,
      leadId: lead.id,
      type: "MISSED_CALL",
      channel: "CALL",
      title: "Missed call",
      body: `Call from ${opts.from}`,
      occurredAt: now,
    },
  });

  const orgVars =
    org.variables && typeof org.variables === "object" && !Array.isArray(org.variables)
      ? (org.variables as Record<string, string>)
      : null;

  const rendered = renderMessage({
    template: (org.missedCallText?.trim() || DEFAULT_TEXTBACK).replace(
      "{{first_name_sp}}",
      lead.name.startsWith("Caller") ? "" : " {{first_name}}",
    ),
    channel: "SMS",
    leadName: lead.name.startsWith("Caller") ? "there" : lead.name,
    unsubLink: "",
    orgVariables: orgVars,
    now,
  });

  try {
    const sender = await getSmsSender(opts.orgId);
    const result = await sender.send({ to: opts.from, body: rendered.body });
    await prisma.leadEvent.create({
      data: {
        orgId: opts.orgId,
        leadId: lead.id,
        type: "SMS_SENT",
        channel: "SMS",
        title: "Auto text-back sent",
        body: rendered.body,
        occurredAt: now,
        meta: { providerId: result.providerId, missedCallTextback: true },
      },
    });
    return { texted: true, leadId: lead.id };
  } catch (e) {
    return { texted: false, reason: e instanceof Error ? e.message : "Send failed" };
  }
}

/** TwiML: ring the forward number, then run the missed-call action on no-answer. */
export function dialTwiml(opts: { forwardNumber: string; actionUrl: string }): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    "<Response>" +
    `<Dial answerOnBridge="true" timeout="18" action="${escapeXml(opts.actionUrl)}" method="POST">` +
    `<Number>${escapeXml(opts.forwardNumber)}</Number>` +
    "</Dial>" +
    "</Response>"
  );
}

/** TwiML: brief spoken line (used when there's no forward number). */
export function sayHangupTwiml(message: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    "<Response>" +
    `<Say>${escapeXml(message)}</Say>` +
    "<Hangup/>" +
    "</Response>"
  );
}

export function emptyTwiml(): string {
  return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
