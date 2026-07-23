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

  // The most recent unresolved AI-drafted reply, if any.
  const aiSuggestion = await prisma.aiSuggestion.findFirst({
    where: { leadId: lead.id, orgId: session.orgId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: { id: true, channel: true, draft: true, rationale: true, createdAt: true },
  });

  return NextResponse.json({ ...lead, pendingMessages, aiSuggestion });
}

const STAGES = ["NEW", "CONTACTED", "ENGAGED", "QUOTED", "BOOKED", "LOST"];

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.lead.findFirst({
    where: { id: params.id, orgId: session.orgId },
    select: { id: true, stage: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    stage?: string;
    tags?: string[];
    ownerId?: string | null;
    dealValueCents?: number | null;
    followUpAt?: string | null;
    needsAttention?: boolean;
  };

  const data: Record<string, unknown> = {};
  if (body.stage !== undefined) {
    const stage = String(body.stage).toUpperCase();
    if (!STAGES.includes(stage)) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
    }
    data.stage = stage;
  }
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) {
      return NextResponse.json({ error: "tags must be an array" }, { status: 400 });
    }
    data.tags = body.tags
      .map((t) => String(t).trim())
      .filter(Boolean)
      .slice(0, 20);
  }
  if (body.ownerId !== undefined) data.ownerId = body.ownerId || null;
  if (body.dealValueCents !== undefined) {
    data.dealValueCents =
      body.dealValueCents == null ? null : Math.max(0, Math.round(body.dealValueCents));
  }
  if (body.followUpAt !== undefined) {
    data.followUpAt = body.followUpAt ? new Date(body.followUpAt) : null;
  }
  if (body.needsAttention !== undefined) data.needsAttention = Boolean(body.needsAttention);

  const updated = await prisma.lead.update({ where: { id: existing.id }, data });

  if (data.stage && data.stage !== existing.stage) {
    await prisma.leadEvent.create({
      data: {
        orgId: session.orgId,
        leadId: existing.id,
        type: data.stage === "LOST" ? "LOST_MARKED" : "STAGE_CHANGED",
        title: `Stage changed: ${existing.stage} → ${data.stage}`,
        occurredAt: new Date(),
      },
    });
  }

  return NextResponse.json(updated);
}
