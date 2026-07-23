import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { getSession } from "@/lib/auth";

type Ctx = { params: { id: string } };

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.property.findFirst({
    where: { id: params.id, orgId: session.orgId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const property = await prisma.property.update({
    where: { id: params.id },
    data: {
      ...(body.name != null ? { name: body.name } : {}),
      ...(body.location !== undefined ? { location: body.location } : {}),
      ...(body.bedrooms !== undefined ? { bedrooms: body.bedrooms } : {}),
      ...(body.type != null ? { type: body.type } : {}),
      ...(body.photoUrl !== undefined ? { photoUrl: body.photoUrl } : {}),
      ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl || null } : {}),
      ...(body.description !== undefined ? { description: body.description || null } : {}),
      ...(body.directBookingUrl !== undefined
        ? { directBookingUrl: body.directBookingUrl }
        : {}),
      ...(body.knowledgeBase !== undefined ? { knowledgeBase: body.knowledgeBase } : {}),
    },
  });

  return NextResponse.json(property);
}
