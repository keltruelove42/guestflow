import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { getSession } from "@/lib/auth";

/** List appointments in a date range (defaults to current month). */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const now = new Date();
  const start = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = to ? new Date(to) : new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const appointments = await prisma.appointment.findMany({
    where: { orgId: session.orgId, startAt: { gte: start, lt: end } },
    include: { lead: { select: { id: true, name: true, email: true, phone: true } } },
    orderBy: { startAt: "asc" },
  });
  return NextResponse.json(appointments);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    leadId?: string | null;
    typeKey?: string;
    title?: string;
    startAt?: string;
    minutes?: number;
    notes?: string;
  };
  if (!body.title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });
  if (!body.startAt) return NextResponse.json({ error: "Start time required" }, { status: 400 });
  const startAt = new Date(body.startAt);
  if (Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
  }
  const minutes = Math.min(480, Math.max(5, Math.round(body.minutes ?? 30)));

  if (body.leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: body.leadId, orgId: session.orgId },
      select: { id: true },
    });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const appt = await prisma.appointment.create({
    data: {
      orgId: session.orgId,
      leadId: body.leadId || null,
      typeKey: body.typeKey?.trim() || "custom",
      title: body.title.trim(),
      startAt,
      endAt: new Date(startAt.getTime() + minutes * 60_000),
      notes: body.notes?.trim() || null,
      source: "manual",
    },
  });

  if (appt.leadId) {
    await prisma.leadEvent.create({
      data: {
        orgId: session.orgId,
        leadId: appt.leadId,
        type: "APPOINTMENT_BOOKED",
        title: `Appointment booked: ${appt.title}`,
        body: appt.startAt.toLocaleString(),
        occurredAt: new Date(),
      },
    });
  }
  return NextResponse.json(appt, { status: 201 });
}
