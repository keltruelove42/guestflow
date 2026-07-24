import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { sendReviewRequest } from "@guestflow/core";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

/** POST /api/v1/leads/[id]/review — send a review request to this lead now. */
export async function POST(_req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lead = await prisma.lead.findFirst({
    where: { id: params.id, orgId: session.orgId },
    select: { id: true },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const r = await sendReviewRequest(session.orgId, params.id);
  if (!r.sent) return NextResponse.json({ error: r.reason ?? "Could not send" }, { status: 400 });
  return NextResponse.json({ ok: true, channel: r.channel });
}
