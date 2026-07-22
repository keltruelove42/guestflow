/**
 * Transparent lead heat score. No black box: every point comes from a
 * visible signal and every score ships with its reasons.
 */

export type ScoreInput = {
  stage: string;
  needsAttention: boolean;
  createdAt: Date;
  /** Most recent lead event, if any */
  lastEventAt?: Date | null;
  lastEventType?: string | null;
  hasActiveEnrollment: boolean;
  dealValueCents?: number | null;
  followUpAt?: Date | null;
  now?: Date;
};

export type LeadScore = {
  score: number; // 0-100
  temp: "hot" | "warm" | "cold";
  reasons: string[];
};

const DAY = 864e5;

export function scoreLead(input: ScoreInput): LeadScore {
  const now = input.now ?? new Date();

  // Closed stages do not compete for attention
  if (input.stage === "BOOKED") {
    return { score: 0, temp: "cold", reasons: ["Already won"] };
  }
  if (input.stage === "LOST") {
    return { score: 0, temp: "cold", reasons: ["Marked lost"] };
  }

  let score = 20;
  const reasons: string[] = [];

  const ageDays = (now.getTime() - input.createdAt.getTime()) / DAY;
  const lastTouchDays = input.lastEventAt
    ? (now.getTime() - input.lastEventAt.getTime()) / DAY
    : ageDays;

  // A human reply is the strongest signal there is
  if (input.needsAttention) {
    score += 40;
    reasons.push("Replied, waiting on you");
  } else if (input.lastEventType === "REPLIED" && lastTouchDays <= 7) {
    score += 30;
    reasons.push("Replied this week");
  }

  // Fresh leads convert on speed
  if (ageDays <= 1) {
    score += 25;
    reasons.push("New in the last 24h");
  } else if (ageDays <= 3) {
    score += 15;
    reasons.push("New this week");
  }

  // Follow-up due
  if (input.followUpAt && input.followUpAt.getTime() <= now.getTime()) {
    score += 25;
    reasons.push("Follow-up due");
  }

  // Mid-funnel beats top-funnel
  if (input.stage === "QUOTED") {
    score += 15;
    reasons.push("Quote on the table");
  } else if (input.stage === "ENGAGED") {
    score += 10;
    reasons.push("Actively engaged");
  }

  // Money on the line
  if ((input.dealValueCents ?? 0) >= 100000) {
    score += 10;
    reasons.push("High deal value");
  }

  // Going cold penalties, softened if automation is still working the lead
  if (lastTouchDays > 14) {
    score -= 20;
    reasons.push("No activity in 2+ weeks");
  } else if (lastTouchDays > 7) {
    score -= 10;
    reasons.push("Quiet for a week");
  }
  if (!input.hasActiveEnrollment && lastTouchDays > 3 && !input.needsAttention) {
    score -= 10;
    reasons.push("No sequence running");
  } else if (input.hasActiveEnrollment && !input.needsAttention) {
    reasons.push("Sequence active");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const temp: LeadScore["temp"] = score >= 60 ? "hot" : score >= 30 ? "warm" : "cold";
  return { score, temp, reasons };
}

/** True when a lead has neither automation nor a human next step. */
export function needsNextStep(input: {
  stage: string;
  needsAttention: boolean;
  hasActiveEnrollment: boolean;
  followUpAt?: Date | null;
}): boolean {
  if (input.stage === "BOOKED" || input.stage === "LOST") return false;
  if (input.needsAttention) return false; // reply queue IS the next step
  if (input.hasActiveEnrollment) return false;
  if (input.followUpAt) return false;
  return true;
}
