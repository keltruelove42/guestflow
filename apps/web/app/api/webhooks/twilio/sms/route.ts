import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { recordInbound, readIntegrationCredentials } from "@guestflow/core";

/**
 * Twilio inbound SMS webhook. Point each Twilio number's "A message
 * comes in" webhook at {APP_URL}/api/webhooks/twilio/sms (HTTP POST).
 * Managed numbers can share this single URL.
 *
 * Lead matching: the To number identifies the org (via its Twilio or
 * managed-sms credentials), then From matches the lead's phone digits.
 */
export async function POST(req: Request) {
  // Shared-secret gate (configure the Twilio webhook URL with ?secret=…).
  // Blocks forged inbound SMS that would inject replies / force opt-outs.
  // (Full X-Twilio-Signature verification is the recommended next step.)
  const secret = process.env.INBOUND_EMAIL_SECRET?.trim();
  if (secret && new URL(req.url).searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Bad payload" }, { status: 400 });

  const from = String(form.get("From") ?? "");
  const to = String(form.get("To") ?? "");
  const bodyText = String(form.get("Body") ?? "").trim();
  if (!from || !bodyText) return twiml();

  const fromDigits = from.replace(/\D/g, "").slice(-10);
  const toDigits = to.replace(/\D/g, "").slice(-10);

  // 1) Which org owns the receiving number?
  let orgId: string | null = null;
  const integrations = await prisma.integration.findMany({
    where: { provider: { in: ["twilio", "managed_sms"] }, status: "CONNECTED" },
    select: { orgId: true, credentials: true },
  });
  for (const row of integrations) {
    const creds = readIntegrationCredentials(row.credentials) as {
      fromNumber?: string;
    } | null;
    const num = String(creds?.fromNumber ?? "").replace(/\D/g, "").slice(-10);
    if (num && num === toDigits) {
      orgId = row.orgId;
      break;
    }
  }

  // 2) Find the lead by phone (scoped to the org when known). Stored
  // phones vary in formatting, so match on the last 4 contiguous digits
  // then verify the full digit string.
  const candidates = await prisma.lead.findMany({
    where: {
      ...(orgId ? { orgId } : {}),
      phone: { contains: fromDigits.slice(-4) },
    },
    orderBy: { updatedAt: "desc" },
    take: 25,
  });
  const lead = candidates.find(
    (l) => (l.phone ?? "").replace(/\D/g, "").slice(-10) === fromDigits,
  );
  if (!lead) return twiml();

  await recordInbound({ leadId: lead.id, text: bodyText, channel: "SMS" });
  return twiml();
}

/** Empty TwiML so Twilio does not auto-reply or error. */
function twiml() {
  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { headers: { "Content-Type": "text/xml" } },
  );
}
