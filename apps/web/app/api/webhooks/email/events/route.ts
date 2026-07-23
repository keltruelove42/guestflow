import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";

/**
 * Resend event webhook — open tracking for Growth analytics.
 * Point a Resend webhook (event: email.opened) at
 *   {APP_URL}/api/webhooks/email/events?secret=INBOUND_EMAIL_SECRET
 * (same shared secret as the inbound webhook).
 *
 * Payload shape (Resend): { type: "email.opened", data: { email_id, ... } }
 * We match email_id against the providerId recorded on the send event's meta
 * and write one EMAIL_OPENED LeadEvent per opened email.
 */
export async function POST(req: Request) {
  const secret = process.env.INBOUND_EMAIL_SECRET?.trim();
  if (secret) {
    const { searchParams } = new URL(req.url);
    if (searchParams.get("secret") !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const raw = (await req.json().catch(() => ({}))) as {
    type?: string;
    data?: { email_id?: string };
  };

  if (raw.type !== "email.opened" || !raw.data?.email_id) {
    // Acknowledge everything else (delivered, bounced, …) without action so
    // Resend doesn't retry.
    return NextResponse.json({ ok: true, handled: false });
  }

  const providerId = raw.data.email_id;

  // Find the send this open belongs to.
  const sendEvent = await prisma.leadEvent.findFirst({
    where: {
      type: { in: ["EMAIL_SENT", "MANUAL_MESSAGE", "AI_REPLY_SENT"] },
      meta: { path: ["providerId"], equals: providerId },
    },
    orderBy: { occurredAt: "desc" },
    select: { orgId: true, leadId: true },
  });
  if (!sendEvent) return NextResponse.json({ ok: true, matched: false });

  // One open event per email — dedupe repeat opens on the same message.
  const existing = await prisma.leadEvent.findFirst({
    where: {
      leadId: sendEvent.leadId,
      type: "EMAIL_OPENED",
      meta: { path: ["providerId"], equals: providerId },
    },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ ok: true, matched: true, deduped: true });

  await prisma.leadEvent.create({
    data: {
      orgId: sendEvent.orgId,
      leadId: sendEvent.leadId,
      type: "EMAIL_OPENED",
      channel: "EMAIL",
      title: "Email opened",
      occurredAt: new Date(),
      meta: { providerId },
    },
  });

  return NextResponse.json({ ok: true, matched: true });
}
