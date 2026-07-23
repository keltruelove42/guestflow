import { prisma } from "@guestflow/db";
import { getAppointmentTypes } from "@guestflow/shared";
import { parseBookingSettings, computeSlots } from "../../appointments/availability";
import { sanitizeVariables } from "../../messaging/render";

/**
 * Agent capabilities as plain server-side functions. These are the single
 * source of truth for "what the AI can do for a business" — the reply agent
 * calls them, and the same set is exposed over MCP (owner's assistant) and,
 * later, agent-to-agent (a lead's own AI booking on their behalf). One tool
 * layer, many surfaces.
 */

export type BusinessContext = {
  businessName: string;
  vertical: string;
  offering: string | null;
  bookingEnabled: boolean;
  appointmentTypes: Array<{ key: string; label: string; minutes: number }>;
  /** Owner-provided facts: services, pricing, policies, custom variables. */
  facts: Record<string, string>;
};

export async function getBusinessContext(
  orgId: string,
  leadId?: string,
): Promise<BusinessContext> {
  const org = await prisma.org.findUniqueOrThrow({
    where: { id: orgId },
    select: {
      name: true,
      vertical: true,
      variables: true,
      bookingSettings: true,
      brandSettings: { select: { businessName: true } },
    },
  });
  const facts = sanitizeVariables(org.variables);
  const settings = parseBookingSettings(org.bookingSettings);

  let offering: string | null = null;
  if (leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, orgId },
      select: { property: { select: { name: true } } },
    });
    offering = lead?.property?.name ?? null;
  }

  return {
    businessName: org.brandSettings?.businessName || facts.business_name || org.name,
    vertical: org.vertical,
    offering,
    bookingEnabled: settings.enabled,
    appointmentTypes: getAppointmentTypes(org.vertical).map((t) => ({
      key: t.key,
      label: t.label,
      minutes: t.minutes,
    })),
    facts,
  };
}

export type OpenSlot = { startISO: string; label: string };

/**
 * Open appointment slots over the next `days` days, honoring booking settings
 * and existing scheduled appointments. Returns at most `limit` slots.
 */
export async function checkAvailability(
  orgId: string,
  opts?: { days?: number; typeKey?: string; limit?: number; now?: Date },
): Promise<{ enabled: boolean; slots: OpenSlot[] }> {
  const org = await prisma.org.findUniqueOrThrow({
    where: { id: orgId },
    select: { vertical: true, bookingSettings: true },
  });
  const settings = parseBookingSettings(org.bookingSettings);
  if (!settings.enabled) return { enabled: false, slots: [] };

  const types = getAppointmentTypes(org.vertical);
  const type = types.find((t) => t.key === opts?.typeKey) ?? types[0]!;
  const days = Math.min(Math.max(opts?.days ?? 10, 1), 30);
  const limit = Math.min(opts?.limit ?? 8, 20);
  const now = opts?.now ?? new Date();

  const horizon = new Date(now.getTime() + days * 86_400_000);
  const busy = await prisma.appointment.findMany({
    where: { orgId, status: "SCHEDULED", startAt: { gte: now, lte: horizon } },
    select: { startAt: true, endAt: true },
  });

  const slots: OpenSlot[] = [];
  for (let d = 0; d < days && slots.length < limit; d++) {
    const dayStart = new Date(now.getTime() + d * 86_400_000);
    dayStart.setHours(0, 0, 0, 0);
    const open = computeSlots({
      dayStart,
      settings,
      durationMinutes: type.minutes,
      busy,
      now,
    });
    for (const s of open) {
      if (slots.length >= limit) break;
      slots.push({
        startISO: s.toISOString(),
        label: s.toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      });
    }
  }
  return { enabled: true, slots };
}

/**
 * Book an appointment for a lead at a specific slot. Re-validates the slot is
 * still open before writing (no double-booking) and records a timeline event.
 */
export async function bookAppointment(
  orgId: string,
  leadId: string,
  opts: { startISO: string; typeKey?: string; source?: string; now?: Date },
): Promise<
  | { ok: true; appointmentId: string; label: string; startISO: string }
  | { ok: false; reason: string }
> {
  const start = new Date(opts.startISO);
  if (Number.isNaN(start.getTime())) return { ok: false, reason: "Invalid time" };
  const now = opts.now ?? new Date();
  if (start.getTime() < now.getTime()) return { ok: false, reason: "That time is in the past" };

  const org = await prisma.org.findUniqueOrThrow({
    where: { id: orgId },
    select: { vertical: true, bookingSettings: true },
  });
  const settings = parseBookingSettings(org.bookingSettings);
  if (!settings.enabled) return { ok: false, reason: "Online booking is off for this business" };

  const lead = await prisma.lead.findFirst({ where: { id: leadId, orgId }, select: { id: true } });
  if (!lead) return { ok: false, reason: "Lead not found" };

  const types = getAppointmentTypes(org.vertical);
  const type = types.find((t) => t.key === opts.typeKey) ?? types[0]!;

  // Re-check the slot is genuinely open for this day.
  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);
  const busy = await prisma.appointment.findMany({
    where: {
      orgId,
      status: "SCHEDULED",
      startAt: { gte: dayStart, lt: new Date(dayStart.getTime() + 86_400_000) },
    },
    select: { startAt: true, endAt: true },
  });
  const open = computeSlots({ dayStart, settings, durationMinutes: type.minutes, busy, now });
  if (!open.some((s) => s.getTime() === start.getTime())) {
    return { ok: false, reason: "That slot was just taken — offer another time" };
  }

  const appt = await prisma.appointment.create({
    data: {
      orgId,
      leadId,
      typeKey: type.key,
      title: type.label,
      startAt: start,
      endAt: new Date(start.getTime() + type.minutes * 60_000),
      source: opts.source ?? "ai",
    },
  });
  await prisma.leadEvent.create({
    data: {
      orgId,
      leadId,
      type: "APPOINTMENT_BOOKED",
      title: `Booked: ${type.label}`,
      body: start.toLocaleString(),
      occurredAt: now,
      meta: { appointmentId: appt.id, via: "ai-agent" },
    },
  });

  return {
    ok: true,
    appointmentId: appt.id,
    startISO: start.toISOString(),
    label: start.toLocaleString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}
