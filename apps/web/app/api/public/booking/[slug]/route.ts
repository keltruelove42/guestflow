import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { computeSlots, parseBookingSettings, createFromCapture } from "@guestflow/core";
import { getAppointmentTypes } from "@guestflow/shared";

type Ctx = { params: { slug: string } };

async function orgBySlug(slug: string) {
  return prisma.org.findFirst({
    where: { bookingSlug: slug },
    select: { id: true, name: true, vertical: true, bookingSettings: true },
  });
}

/**
 * Public booking data. No auth: exposes only org name, types, and open
 * slot times. ?date=YYYY-MM-DD&type=key returns slots for that day.
 */
export async function GET(req: Request, { params }: Ctx) {
  const org = await orgBySlug(params.slug);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const settings = parseBookingSettings(org.bookingSettings);
  if (!settings.enabled) return NextResponse.json({ error: "Booking is off" }, { status: 404 });

  const types = getAppointmentTypes(org.vertical);
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");
  const typeKey = searchParams.get("type");

  if (!dateStr) {
    return NextResponse.json({
      name: org.name,
      types,
      days: settings.days,
      slotMinutes: settings.slotMinutes,
    });
  }

  const dayStart = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(dayStart.getTime())) {
    return NextResponse.json({ error: "Bad date" }, { status: 400 });
  }
  const type = types.find((t) => t.key === typeKey) ?? types[0]!;
  const dayEnd = new Date(dayStart.getTime() + 864e5);
  const busy = await prisma.appointment.findMany({
    where: {
      orgId: org.id,
      status: "SCHEDULED",
      startAt: { gte: dayStart, lt: dayEnd },
    },
    select: { startAt: true, endAt: true },
  });
  const slots = computeSlots({
    dayStart,
    settings,
    durationMinutes: type.minutes,
    busy,
  });
  return NextResponse.json({ slots: slots.map((s) => s.toISOString()) });
}

/** Public booking submission: creates/merges the lead + appointment. */
export async function POST(req: Request, { params }: Ctx) {
  const org = await orgBySlug(params.slug);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const settings = parseBookingSettings(org.bookingSettings);
  if (!settings.enabled) return NextResponse.json({ error: "Booking is off" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    typeKey?: string;
    startAt?: string;
    name?: string;
    email?: string;
    phone?: string;
    notes?: string;
    consent?: boolean;
  };
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim() || null;
  const phone = String(body.phone ?? "").trim() || null;
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!email && !phone) {
    return NextResponse.json({ error: "Email or phone is required" }, { status: 400 });
  }
  const startAt = new Date(String(body.startAt ?? ""));
  if (Number.isNaN(startAt.getTime()) || startAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Pick a valid future time" }, { status: 400 });
  }

  const types = getAppointmentTypes(org.vertical);
  const type = types.find((t) => t.key === body.typeKey) ?? types[0]!;

  // Slot still free? (re-check to prevent double booking)
  const dayStart = new Date(startAt);
  dayStart.setHours(0, 0, 0, 0);
  const busy = await prisma.appointment.findMany({
    where: {
      orgId: org.id,
      status: "SCHEDULED",
      startAt: { gte: dayStart, lt: new Date(dayStart.getTime() + 864e5) },
    },
    select: { startAt: true, endAt: true },
  });
  const open = computeSlots({ dayStart, settings, durationMinutes: type.minutes, busy });
  if (!open.some((s) => s.getTime() === startAt.getTime())) {
    return NextResponse.json(
      { error: "That time was just taken. Pick another slot" },
      { status: 409 },
    );
  }

  const consent = body.consent !== false;
  const capture = await createFromCapture({
    orgId: org.id,
    name,
    email,
    phone,
    source: "DIRECT_SITE",
    emailConsent: consent && Boolean(email),
    smsConsent: consent && Boolean(phone),
    consentText: "Booked via public booking page",
    isDemo: false,
  });

  const appt = await prisma.appointment.create({
    data: {
      orgId: org.id,
      leadId: capture.leadId,
      typeKey: type.key,
      title: type.label,
      startAt,
      endAt: new Date(startAt.getTime() + type.minutes * 60_000),
      notes: body.notes?.trim() || null,
      source: "public",
    },
  });

  await prisma.leadEvent.create({
    data: {
      orgId: org.id,
      leadId: capture.leadId,
      type: "APPOINTMENT_BOOKED",
      title: `Appointment booked online: ${type.label}`,
      body: startAt.toLocaleString(),
      occurredAt: new Date(),
    },
  });

  // Best-effort confirmation email
  if (email && consent) {
    try {
      const { getEmailSender } = await import("@guestflow/core");
      const sender = await getEmailSender(org.id);
      const when = startAt.toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      await sender.send({
        to: email,
        subject: `Confirmed: ${type.label} with ${org.name}`,
        text: `Hi ${name.split(" ")[0]},\n\nYou are booked: ${type.label} on ${when}.\n\nNeed to change it? Just reply to this email.\n\n${org.name}`,
        html: `Hi ${name.split(" ")[0]},<br/><br/>You are booked: <b>${type.label}</b> on <b>${when}</b>.<br/><br/>Need to change it? Just reply to this email.<br/><br/>${org.name}`,
      });
    } catch {
      /* confirmation is best-effort */
    }
  }

  return NextResponse.json({
    ok: true,
    title: type.label,
    startAt: appt.startAt.toISOString(),
    orgName: org.name,
  });
}
