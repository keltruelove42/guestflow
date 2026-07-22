/**
 * Availability engine for the booking calendar. Pure functions, easy to
 * test: settings + existing appointments in, open slots out.
 */

export type BookingSettings = {
  enabled: boolean;
  slotMinutes: number;
  bufferMinutes: number;
  startHour: number; // 0-23, org-local
  endHour: number; // 0-23
  days: number[]; // 0=Sun .. 6=Sat
};

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  enabled: false,
  slotMinutes: 30,
  bufferMinutes: 10,
  startHour: 9,
  endHour: 17,
  days: [1, 2, 3, 4, 5],
};

export function parseBookingSettings(raw: unknown): BookingSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_BOOKING_SETTINGS };
  const o = raw as Record<string, unknown>;
  const num = (v: unknown, d: number, min: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : d;
  };
  return {
    enabled: Boolean(o.enabled),
    slotMinutes: num(o.slotMinutes, 30, 10, 240),
    bufferMinutes: num(o.bufferMinutes, 10, 0, 120),
    startHour: num(o.startHour, 9, 0, 23),
    endHour: num(o.endHour, 17, 1, 24),
    days: Array.isArray(o.days)
      ? (o.days.map(Number).filter((d) => d >= 0 && d <= 6) as number[])
      : [1, 2, 3, 4, 5],
  };
}

export type Busy = { startAt: Date; endAt: Date };

/**
 * Open slot start times (Date, org-local wall clock treated as-is) for
 * one calendar day. `dayStart` must be midnight of the target day.
 */
export function computeSlots(opts: {
  dayStart: Date;
  settings: BookingSettings;
  durationMinutes: number;
  busy: Busy[];
  now?: Date;
}): Date[] {
  const { dayStart, settings, durationMinutes, busy } = opts;
  const now = opts.now ?? new Date();
  if (!settings.days.includes(dayStart.getDay())) return [];

  const open: Date[] = [];
  const dayOpen = new Date(dayStart);
  dayOpen.setHours(settings.startHour, 0, 0, 0);
  const dayClose = new Date(dayStart);
  dayClose.setHours(settings.endHour, 0, 0, 0);

  const step = settings.slotMinutes * 60_000;
  const need = durationMinutes * 60_000;
  const pad = settings.bufferMinutes * 60_000;

  for (let t = dayOpen.getTime(); t + need <= dayClose.getTime(); t += step) {
    const slotStart = t;
    const slotEnd = t + need;
    if (slotStart < now.getTime()) continue;
    const clash = busy.some(
      (b) => slotStart < b.endAt.getTime() + pad && slotEnd > b.startAt.getTime() - pad,
    );
    if (!clash) open.push(new Date(slotStart));
  }
  return open;
}

/** URL-safe slug from an org name. */
export function toBookingSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "book";
}
