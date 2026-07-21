import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { getSession } from "@/lib/auth";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lead = await prisma.lead.findFirst({
    where: { id: params.id, orgId: session.orgId },
    include: {
      property: { select: { id: true, name: true, directBookingUrl: true } },
      campaign: { select: { id: true, name: true, platform: true } },
      enrollments: {
        where: { status: { in: ["ACTIVE", "PAUSED", "COMPLETED"] } },
        include: {
          sequence: { select: { id: true, name: true } },
          scheduled: {
            where: { status: "PENDING" },
            orderBy: { sendAt: "asc" },
            take: 10,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      events: { orderBy: { occurredAt: "desc" }, take: 80 },
    },
  });

  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pendingMessages = lead.enrollments.flatMap((e) =>
    e.scheduled.map((m) => ({
      ...m,
      sequenceName: e.sequence.name,
    })),
  );

  return NextResponse.json({ ...lead, pendingMessages });
}
