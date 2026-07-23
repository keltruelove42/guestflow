import { describe, expect, it } from "vitest";
import { trialEndDate, TRIAL_DAYS } from "./trial";

describe("trialEndDate", () => {
  it("is exactly 7 days out", () => {
    expect(TRIAL_DAYS).toBe(7);
    const from = new Date("2026-07-23T12:00:00Z");
    expect(trialEndDate(from).toISOString()).toBe("2026-07-30T12:00:00.000Z");
  });
});
