import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { scoreLead, needsNextStep } from "@guestflow/core";
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
      events: { orderBy: { occurredAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const enriched = leads.map((l) => {
    const lastEvent = l.events[0] ?? null;
    const heat = scoreLead({
      stage: l.stage,
      needsAttention: l.needsAttention,
      createdAt: l.createdAt,
      lastEventAt: lastEvent?.occurredAt ?? null,
      lastEventType: lastEvent?.type ?? null,
      hasActiveEnrollment: l.enrollments.some((e) => e.status === "ACTIVE"),
      dealValueCents: l.dealValueCents,
      followUpAt: l.followUpAt,
      now,
    });
    const missingNextStep = needsNextStep({
      stage: l.stage,
      needsAttention: l.needsAttention,
      hasActiveEnrollment: l.enrollments.some((e) => e.status === "ACTIVE"),
      followUpAt: l.followUpAt,
    });
    const { events: _events, ...rest } = l;
    return { ...rest, lastEventAt: lastEvent?.occurredAt ?? null, heat, missingNextStep };
  });

  return NextResponse.json(enriched);
}
