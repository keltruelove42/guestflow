import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { getSession } from "@/lib/auth";

type Ctx = { params: { id: string } };
const STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"];

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.appointment.findFirst({
    where: { id: params.id, orgId: session.orgId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    status?: string;
    startAt?: string;
    minutes?: number;
    notes?: string | null;
  };

  const data: Record<string, unknown> = {};
  if (body.status !== undefined) {
    const status = String(body.status).toUpperCase();
    if (!STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = status;
  }
  if (body.startAt !== undefined) {
    const startAt = new Date(body.startAt);
    if (Number.isNaN(startAt.getTime())) {
      return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
    }
    const duration = existing.endAt.getTime() - existing.startAt.getTime();
    const minutes = body.minutes
      ? Math.min(480, Math.max(5, Math.round(body.minutes))) * 60_000
      : duration;
    data.startAt = startAt;
    data.endAt = new Date(startAt.getTime() + minutes);
    data.reminderSentAt = null; // re-arm the reminder for the new time
  }
  if (body.notes !== undefined) data.notes = body.notes?.trim() || null;

  const updated = await prisma.appointment.update({ where: { id: existing.id }, data });

  if (existing.leadId && data.status && data.status !== existing.status) {
    const label =
      data.status === "COMPLETED"
        ? "completed"
        : data.status === "NO_SHOW"
          ? "no-show"
          : data.status === "CANCELLED"
            ? "cancelled"
            : "rescheduled";
    await prisma.leadEvent.create({
      data: {
        orgId: session.orgId,
        leadId: existing.leadId,
        type: "APPOINTMENT_BOOKED",
        title: `Appointment ${label}: ${existing.title}`,
        occurredAt: new Date(),
      },
    });
  }
  return NextResponse.json(updated);
}
