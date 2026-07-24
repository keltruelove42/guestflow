import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { getSession } from "@/lib/auth";

const DEFAULT_TEXT =
  "Hi {{first_name}}, sorry we missed your call at {{business_name}}! Reply here and we'll help you right away.";

/** GET /api/v1/org/missed-call — settings + the Voice webhook URL to configure. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await prisma.org.findUniqueOrThrow({
    where: { id: session.orgId },
    select: { missedCallEnabled: true, voiceForwardPhone: true, missedCallText: true },
  });
  const appUrl = process.env.APP_URL ?? "";
  const hasSecret = Boolean(process.env.INBOUND_EMAIL_SECRET);
  return NextResponse.json({
    enabled: org.missedCallEnabled,
    forwardPhone: org.voiceForwardPhone,
    text: org.missedCallText,
    defaultText: DEFAULT_TEXT,
    webhookUrl: appUrl
      ? `${appUrl}/api/webhooks/twilio/voice${hasSecret ? "?secret=YOUR_INBOUND_EMAIL_SECRET" : ""}`
      : null,
  });
}

/** PUT /api/v1/org/missed-call { enabled?, forwardPhone?, text? }. */
export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    enabled?: boolean;
    forwardPhone?: string | null;
    text?: string | null;
  };

  const data: Record<string, unknown> = {};
  if (body.enabled !== undefined) data.missedCallEnabled = Boolean(body.enabled);
  if (body.forwardPhone !== undefined) {
    const v = String(body.forwardPhone ?? "").trim();
    data.voiceForwardPhone = v || null;
  }
  if (body.text !== undefined) {
    data.missedCallText = String(body.text ?? "").trim().slice(0, 480) || null;
  }

  await prisma.org.update({ where: { id: session.orgId }, data });
  return NextResponse.json({ ok: true });
}
