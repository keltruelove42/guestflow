import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { recordInbound } from "@guestflow/core";

/**
 * Generic inbound email webhook. Works with Resend inbound, CloudMailin,
 * SendGrid Inbound Parse, or anything that can POST JSON.
 *
 * Secure it with INBOUND_EMAIL_SECRET: the sender must call
 * {APP_URL}/api/webhooks/email/inbound?secret=YOUR_SECRET
 *
 * Accepted shapes:
 *   { from, subject, text }                     (generic)
 *   { data: { from, subject, text } }           (Resend event style)
 */
export async function POST(req: Request) {
  const secret = process.env.INBOUND_EMAIL_SECRET?.trim();
  if (secret) {
    const { searchParams } = new URL(req.url);
    if (searchParams.get("secret") !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data = (raw.data && typeof raw.data === "object" ? raw.data : raw) as Record<
    string,
    unknown
  >;

  const fromRaw = String(data.from ?? "");
  const emailMatch = fromRaw.match(/[^\s<>"']+@[^\s<>"']+\.[^\s<>"']+/);
  const fromEmail = emailMatch?.[0]?.toLowerCase() ?? null;
  const text = String(data.text ?? data.body ?? "").trim();
  if (!fromEmail || !text) {
    return NextResponse.json({ ok: true, matched: false });
  }

  // Strip quoted history: keep content above the first quote marker
  const reply =
    text
      .split(/\r?\n(?:>|On .{10,80} wrote:|-{2,}\s*Original Message)/)[0]
      ?.trim()
      .slice(0, 4000) || text.slice(0, 4000);

  const lead = await prisma.lead.findFirst({
    where: { email: fromEmail },
    orderBy: { updatedAt: "desc" },
  });
  if (!lead) return NextResponse.json({ ok: true, matched: false });

  await recordInbound({ leadId: lead.id, text: reply, channel: "EMAIL" });
  return NextResponse.json({ ok: true, matched: true });
}
