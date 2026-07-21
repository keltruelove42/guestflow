import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { getSession } from "@/lib/auth";

type Ctx = { params: { id: string } };

export async function POST(_req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sequence = await prisma.sequence.updateMany({
    where: { id: params.id, orgId: session.orgId },
    data: { active: true },
  });
  if (sequence.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const full = await prisma.sequence.findUniqueOrThrow({
    where: { id: params.id },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json(full);
}
