import { describe, expect, it } from "vitest";
import { needsNextStep, scoreLead } from "./score";

const now = new Date("2026-07-22T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 864e5);

describe("scoreLead", () => {
  it("ranks a fresh reply-waiting lead as hot with reasons", () => {
    const s = scoreLead({
      stage: "ENGAGED",
      needsAttention: true,
      createdAt: daysAgo(0.5),
      lastEventAt: daysAgo(0.1),
      lastEventType: "REPLIED",
      hasActiveEnrollment: true,
      now,
    });
    expect(s.temp).toBe("hot");
    expect(s.reasons).toContain("Replied, waiting on you");
    expect(s.reasons).toContain("New in the last 24h");
  });

  it("zeroes closed stages", () => {
    expect(scoreLead({ stage: "BOOKED", needsAttention: false, createdAt: daysAgo(1), hasActiveEnrollment: false, now }).score).toBe(0);
    expect(scoreLead({ stage: "LOST", needsAttention: false, createdAt: daysAgo(1), hasActiveEnrollment: false, now }).score).toBe(0);
  });

  it("penalizes stale unmanaged leads to cold", () => {
    const s = scoreLead({
      stage: "CONTACTED",
      needsAttention: false,
      createdAt: daysAgo(40),
      lastEventAt: daysAgo(21),
      hasActiveEnrollment: false,
      now,
    });
    expect(s.temp).toBe("cold");
    expect(s.reasons).toContain("No activity in 2+ weeks");
  });

  it("keeps scores in 0-100", () => {
    const s = scoreLead({
      stage: "QUOTED",
      needsAttention: true,
      createdAt: daysAgo(0.2),
      lastEventAt: daysAgo(0.1),
      lastEventType: "REPLIED",
      hasActiveEnrollment: true,
      dealValueCents: 500000,
      followUpAt: daysAgo(0.1),
      now,
    });
    expect(s.score).toBeLessThanOrEqual(100);
    expect(s.temp).toBe("hot");
  });
});

describe("needsNextStep", () => {
  it("flags open leads with no automation, no task, no reply pending", () => {
    expect(
      needsNextStep({ stage: "NEW", needsAttention: false, hasActiveEnrollment: false }),
    ).toBe(true);
  });
  it("does not flag managed or closed leads", () => {
    expect(
      needsNextStep({ stage: "NEW", needsAttention: false, hasActiveEnrollment: true }),
    ).toBe(false);
    expect(
      needsNextStep({ stage: "BOOKED", needsAttention: false, hasActiveEnrollment: false }),
    ).toBe(false);
    expect(
      needsNextStep({ stage: "NEW", needsAttention: true, hasActiveEnrollment: false }),
    ).toBe(false);
  });
});
