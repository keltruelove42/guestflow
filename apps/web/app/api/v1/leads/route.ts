import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { scoreLead, needsNextStep, importLeads } from "@guestflow/core";
import { getSession } from "@/lib/auth";

/**
 * POST /api/v1/leads — add a single lead by hand.
 * { name, email?, phone?, propertyName?, travelDates?, notes?, emailConsent?, smsConsent? }
 * Requires name + at least one of email/phone. Dedupes/merges like import.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    phone?: string;
    propertyName?: string;
    travelDates?: string;
    notes?: string;
    emailConsent?: boolean;
    smsConsent?: boolean;
  };

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim() || null;
  const phone = String(body.phone ?? "").trim() || null;
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  // A manual "Add lead" is an explicit human action: always create a new lead.
  // (Silent merge-on-shared-phone was making every test lead collapse into the
  // first.) We still surface a soft duplicate hint so real dupes aren't hidden.
  const dupOr = [
    ...(email ? [{ email }] : []),
    ...(phone ? [{ phone }] : []),
  ];
  const dup = dupOr.length
    ? await prisma.lead.findFirst({
        where: { orgId: session.orgId, OR: dupOr },
        select: { id: true, name: true },
      })
    : null;

  const result = await importLeads({
    orgId: session.orgId,
    source: "MANUAL",
    sourceTitle: "Added manually",
    dedupeBy: "none",
    requireContact: false,
    emailConsent: Boolean(body.emailConsent),
    smsConsent: Boolean(body.smsConsent),
    rows: [
      {
        name,
        email,
        phone,
        propertyName: body.propertyName?.trim() || null,
        travelDates: body.travelDates?.trim() || null,
        notes: body.notes?.trim() || null,
      },
    ],
  });

  if (result.errors.length || !result.leadIds[0]) {
    return NextResponse.json(
      { error: result.errors[0]?.reason ?? "Could not add lead" },
      { status: 400 },
    );
  }
  return NextResponse.json({
    leadId: result.leadIds[0],
    merged: false,
    duplicate: dup ? { id: dup.id, name: dup.name } : null,
  });
}

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
      notes: { orderBy: { createdAt: "desc" }, take: 1, select: { text: true } },
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
    const { events: _events, notes: _notes, ...rest } = l;
    return {
      ...rest,
      lastEventAt: lastEvent?.occurredAt ?? null,
      latestNote: l.notes[0]?.text ?? null,
      heat,
      missingNextStep,
    };
  });

  return NextResponse.json(enriched);
}
