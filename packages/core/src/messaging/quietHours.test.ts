import { describe, expect, it } from "vitest";
import { isInQuietHours, localHourInTz, shouldDeferForQuietHours } from "./quietHours";

describe("quiet hours", () => {
  it("detects wrap-midnight window (21–9)", () => {
    expect(isInQuietHours(21, 21, 9)).toBe(true);
    expect(isInQuietHours(23, 21, 9)).toBe(true);
    expect(isInQuietHours(0, 21, 9)).toBe(true);
    expect(isInQuietHours(8, 21, 9)).toBe(true);
    expect(isInQuietHours(9, 21, 9)).toBe(false);
    expect(isInQuietHours(20, 21, 9)).toBe(false);
  });

  it("8:59pm local is outside default quiet; 9:01pm is inside", () => {
    // Construct a UTC date that is 20:59 in America/New_York (EDT = UTC-4 in July)
    // 20:59 EDT = 00:59 UTC next day
    const before = new Date("2026-07-15T00:59:00Z"); // 20:59 EDT Jul 14
    const after = new Date("2026-07-15T01:01:00Z"); // 21:01 EDT Jul 14

    expect(localHourInTz(before, "America/New_York")).toBe(20);
    expect(localHourInTz(after, "America/New_York")).toBe(21);

    expect(shouldDeferForQuietHours({
      now: before,
      quietStart: 21,
      quietEnd: 9,
      timeZone: "America/New_York",
    }).defer).toBe(false);

    const deferred = shouldDeferForQuietHours({
      now: after,
      quietStart: 21,
      quietEnd: 9,
      timeZone: "America/New_York",
    });
    expect(deferred.defer).toBe(true);
    if (deferred.defer) {
      expect(localHourInTz(deferred.sendAt, "America/New_York")).toBe(9);
    }
  });
});
