import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    where: { orgId: session.orgId },
    select: { id: true, name: true, email: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(users);
}
