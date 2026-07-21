import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("property");
  const stage = searchParams.get("stage");
  const source = searchParams.get("source");

  const leads = await prisma.lead.findMany({
    where: {
      orgId: session.orgId,
      ...(propertyId && propertyId !== "all" ? { propertyId } : {}),
      ...(stage && stage !== "All" && stage !== "ALL"
        ? { stage: stage.toUpperCase() as never }
        : {}),
      ...(source && source !== "all" ? { source: source.toUpperCase() as never } : {}),
    },
    include: {
      property: true,
      campaign: true,
      enrollments: {
        where: { status: { in: ["ACTIVE", "PAUSED"] } },
        include: { sequence: true },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(leads);
}
