import { describe, expect, it } from "vitest";
import { computeSlots, parseBookingSettings, toBookingSlug, DEFAULT_BOOKING_SETTINGS } from "./availability";

const monday = new Date("2026-07-20T00:00:00"); // a Monday, local
const now = new Date("2026-07-19T08:00:00");

describe("computeSlots", () => {
  const settings = { ...DEFAULT_BOOKING_SETTINGS, enabled: true };

  it("produces slots inside working hours only", () => {
    const slots = computeSlots({ dayStart: monday, settings, durationMinutes: 30, busy: [], now });
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]!.getHours()).toBe(9);
    const last = slots[slots.length - 1]!;
    expect(last.getHours() * 60 + last.getMinutes() + 30).toBeLessThanOrEqual(17 * 60);
  });

  it("skips closed days", () => {
    const sunday = new Date("2026-07-19T00:00:00");
    expect(computeSlots({ dayStart: sunday, settings, durationMinutes: 30, busy: [], now })).toHaveLength(0);
  });

  it("removes slots colliding with busy blocks including buffer", () => {
    const busy = [{ startAt: new Date("2026-07-20T10:00:00"), endAt: new Date("2026-07-20T10:30:00") }];
    const slots = computeSlots({ dayStart: monday, settings, durationMinutes: 30, busy, now });
    const at10 = slots.find((s) => s.getHours() === 10 && s.getMinutes() === 0);
    expect(at10).toBeUndefined();
    // buffer of 10min also kills the 10:30 slot
    const at1030 = slots.find((s) => s.getHours() === 10 && s.getMinutes() === 30);
    expect(at1030).toBeUndefined();
  });

  it("hides past slots", () => {
    const lateNow = new Date("2026-07-20T15:00:00");
    const slots = computeSlots({ dayStart: monday, settings, durationMinutes: 30, busy: [], now: lateNow });
    expect(slots.every((s) => s.getTime() >= lateNow.getTime())).toBe(true);
  });
});

describe("parseBookingSettings / toBookingSlug", () => {
  it("clamps bad values to sane defaults", () => {
    const s = parseBookingSettings({ slotMinutes: 5000, bufferMinutes: -3, startHour: 99 });
    expect(s.slotMinutes).toBe(240);
    expect(s.bufferMinutes).toBe(0);
    expect(s.startHour).toBe(23);
  });
  it("slugifies org names", () => {
    expect(toBookingSlug("Dana Dealer's Dealership")).toBe("dana-dealer-s-dealership");
    expect(toBookingSlug("!!!")).toBe("book");
  });
});
