import { prisma } from "@guestflow/db";

/**
 * 7-day free trial with send-credit caps. Enforcement applies only to
 * LIVE-mode orgs on the TRIAL plan — demo workspaces log sends and are never
 * blocked, and any paid plan lifts both the clock and the caps.
 */

export const TRIAL_DAYS = 7;
export const TRIAL_EMAIL_CREDITS = 100;
export const TRIAL_SMS_CREDITS = 25;

export function trialEndDate(from: Date = new Date()): Date {
  return new Date(from.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

export type TrialStatus = {
  onTrial: boolean;
  /** Null when not applicable (paid plan or legacy org with no end date). */
  endsAt: Date | null;
  expired: boolean;
  daysLeft: number | null;
  emails: { used: number; limit: number; remaining: number };
  sms: { used: number; limit: number; remaining: number };
};

async function countSends(orgId: string): Promise<{ emails: number; sms: number }> {
  const [emails, sms] = await Promise.all([
    prisma.leadEvent.count({
      where: {
        orgId,
        OR: [
          { type: "EMAIL_SENT" },
          { type: { in: ["MANUAL_MESSAGE", "AI_REPLY_SENT"] }, channel: "EMAIL" },
        ],
      },
    }),
    prisma.leadEvent.count({
      where: {
        orgId,
        OR: [
          { type: "SMS_SENT" },
          { type: { in: ["MANUAL_MESSAGE", "AI_REPLY_SENT"] }, channel: "SMS" },
        ],
      },
    }),
  ]);
  return { emails, sms };
}

export async function getTrialStatus(orgId: string): Promise<TrialStatus> {
  const org = await prisma.org.findUniqueOrThrow({
    where: { id: orgId },
    select: { plan: true, mode: true, trialEndsAt: true, createdAt: true },
  });

  const onTrial = org.plan === "TRIAL";
  const endsAt = onTrial ? org.trialEndsAt : null;
  const now = new Date();
  const expired = Boolean(onTrial && endsAt && endsAt < now);
  const daysLeft =
    onTrial && endsAt
      ? Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000))
      : null;

  const usage = onTrial ? await countSends(orgId) : { emails: 0, sms: 0 };

  return {
    onTrial,
    endsAt,
    expired,
    daysLeft,
    emails: {
      used: usage.emails,
      limit: TRIAL_EMAIL_CREDITS,
      remaining: Math.max(0, TRIAL_EMAIL_CREDITS - usage.emails),
    },
    sms: {
      used: usage.sms,
      limit: TRIAL_SMS_CREDITS,
      remaining: Math.max(0, TRIAL_SMS_CREDITS - usage.sms),
    },
  };
}

export type SendGate =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Send-time guard. Call with the org (plan/mode/trialEndsAt already loaded)
 * before dispatching a LIVE email/SMS. Demo-mode sends are never blocked.
 */
export async function checkTrialSendAllowed(
  org: { id: string; plan: string; mode: string; trialEndsAt: Date | null },
  channel: "EMAIL" | "SMS" | "CALL",
  now: Date = new Date(),
): Promise<SendGate> {
  if (org.plan !== "TRIAL") return { allowed: true };
  if (org.mode === "DEMO") return { allowed: true };
  if (channel === "CALL") return { allowed: true };

  if (org.trialEndsAt && org.trialEndsAt < now) {
    return {
      allowed: false,
      reason: "Free trial ended — pick a plan to keep sending",
    };
  }

  const usage = await countSends(org.id);
  if (channel === "EMAIL" && usage.emails >= TRIAL_EMAIL_CREDITS) {
    return {
      allowed: false,
      reason: `Trial email limit reached (${TRIAL_EMAIL_CREDITS}) — upgrade to keep sending`,
    };
  }
  if (channel === "SMS" && usage.sms >= TRIAL_SMS_CREDITS) {
    return {
      allowed: false,
      reason: `Trial SMS limit reached (${TRIAL_SMS_CREDITS}) — upgrade to keep sending`,
    };
  }
  return { allowed: true };
}
