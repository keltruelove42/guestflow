import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { getSession } from "@/lib/auth";
import { requireGrowth } from "@/lib/growth";

/** GET /api/v1/org/enrichment — enrichment settings. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await prisma.org.findUniqueOrThrow({
    where: { id: session.orgId },
    select: { enrichAuto: true, enrichWebhookUrl: true, plan: true },
  });
  return NextResponse.json({
    auto: org.enrichAuto,
    webhookUrl: org.enrichWebhookUrl,
    available: org.plan === "GROWTH" || org.plan === "ENTERPRISE",
  });
}

/** PUT /api/v1/org/enrichment { auto?, webhookUrl? } — Growth/Enterprise. */
export async function PUT(req: Request) {
  const gate = await requireGrowth();
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => ({}))) as {
    auto?: boolean;
    webhookUrl?: string | null;
  };
  let webhookUrl: string | null | undefined = undefined;
  if (body.webhookUrl !== undefined) {
    const v = String(body.webhookUrl ?? "").trim();
    if (v && !/^https:\/\//.test(v)) {
      return NextResponse.json({ error: "Webhook URL must start with https://" }, { status: 400 });
    }
    webhookUrl = v || null;
  }

  const org = await prisma.org.update({
    where: { id: gate.session.orgId },
    data: {
      ...(body.auto !== undefined ? { enrichAuto: Boolean(body.auto) } : {}),
      ...(webhookUrl !== undefined ? { enrichWebhookUrl: webhookUrl } : {}),
    },
    select: { enrichAuto: true, enrichWebhookUrl: true },
  });
  return NextResponse.json({ auto: org.enrichAuto, webhookUrl: org.enrichWebhookUrl });
}
