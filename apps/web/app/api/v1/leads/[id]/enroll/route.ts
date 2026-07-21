import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { enrollLeadSchema } from "@guestflow/shared";
import { manualEnroll } from "@guestflow/core";
import { getSession } from "@/lib/auth";

type Ctx = { params: { id: string } };

export async function POST(req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lead = await prisma.lead.findFirst({
    where: { id: params.id, orgId: session.orgId },
    select: { id: true },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = enrollLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "sequenceId required" }, { status: 400 });
  }

  const result = await manualEnroll(lead.id, parsed.data.sequenceId);
  if (!result.enrolled) {
    return NextResponse.json({ error: result.reason }, { status: 409 });
  }
  return NextResponse.json(result);
}
