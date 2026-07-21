import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { getSession } from "@/lib/auth";

type Ctx = { params: { id: string; blockId: string } };

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const block = await prisma.availabilityBlock.findFirst({
    where: {
      id: params.blockId,
      propertyId: params.id,
      orgId: session.orgId,
    },
  });
  if (!block) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.availabilityBlock.delete({ where: { id: block.id } });
  return new NextResponse(null, { status: 204 });
}
