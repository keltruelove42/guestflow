import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { getSession } from "@/lib/auth";

type Ctx = { params: { id: string } };

/**
 * POST /api/v1/leads/[id]/redemptions — log a discount-code redemption for a
 * lead ({ code }). Feeds the Growth "code redemptions" analytics; shows on
 * the lead timeline.
 */
export async function POST(req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lead = await prisma.lead.findFirst({
    where: { id: params.id, orgId: session.orgId },
    select: { id: true },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { code?: string };
  const code = String(body.code ?? "")
    .trim()
    .slice(0, 60);
  if (!code) return NextResponse.json({ error: "Code is required" }, { status: 400 });

  const event = await prisma.leadEvent.create({
    data: {
      orgId: session.orgId,
      leadId: lead.id,
      type: "CODE_REDEEMED",
      title: `Code redeemed: ${code}`,
      occurredAt: new Date(),
      meta: { code },
    },
  });

  return NextResponse.json({ ok: true, eventId: event.id });
}
