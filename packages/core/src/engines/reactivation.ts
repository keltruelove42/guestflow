import { prisma, type Prisma } from "@guestflow/db";
import { bestChannel, deliverToLead } from "./send";
import { shouldDeferForQuietHours } from "../messaging/quietHours";

/**
 * Reactivation engine — mine the client's existing list. One-off nudge to a
 * segment of dormant/past leads: the cheapest leads a business has.
 */

export type ReactivationSegment = "lost" | "cold_90d" | "past_customers";

const CAP = 300; // safety cap per run

function segmentWhere(orgId: string, segment: ReactivationSegment): Prisma.LeadWhereInput {
  const base: Prisma.LeadWhereInput = { orgId, isDemo: false };
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000);
  switch (segment) {
    case "lost":
      return { ...base, stage: "LOST" };
    case "past_customers":
      return { ...base, stage: "BOOKED" };
    case "cold_90d":
      return {
        ...base,
        stage: { notIn: ["BOOKED", "LOST"] },
        updatedAt: { lt: ninetyDaysAgo },
      };
    default:
      return base;
  }
}

export const REACTIVATION_SEGMENTS: Array<{ id: ReactivationSegment; label: string; hint: string }> = [
  { id: "cold_90d", label: "Gone quiet (90+ days)", hint: "Open leads with no activity in 3 months" },
  { id: "past_customers", label: "Past customers", hint: "Everyone who booked — rebook & referrals" },
  { id: "lost", label: "Lost leads", hint: "Marked lost — worth another try" },
];

/** How many leads in a segment are reachable on a channel (have consent). */
export async function previewReactivation(
  orgId: string,
  segment: ReactivationSegment,
  channel: "EMAIL" | "SMS",
): Promise<{ total: number; reachable: number }> {
  const where = segmentWhere(orgId, segment);
  const total = await prisma.lead.count({ where });
  const reachable = await prisma.lead.count({
    where:
      channel === "SMS"
        ? { ...where, phone: { not: null }, smsConsent: true, smsStoppedAt: null }
        : { ...where, email: { not: null }, emailConsent: true, unsubscribedAt: null },
  });
  return { total, reachable };
}

export async function runReactivation(opts: {
  orgId: string;
  segment: ReactivationSegment;
  channel: "EMAIL" | "SMS";
  subject?: string | null;
  message: string;
  /**
   * Emergency override — bypass the quiet-hours guard for genuinely urgent,
   * time-sensitive outreach (e.g. a trade's emergency-repair availability).
   * Requires a reason, which is stamped on each send for the audit trail.
   */
  emergency?: boolean;
  emergencyReason?: string | null;
  now?: Date;
}): Promise<{ sent: number; skipped: number; blocked?: string }> {
  const now = opts.now ?? new Date();
  const emergency = Boolean(opts.emergency);

  // Foolproof quiet-hours guard: never blast SMS to leads overnight. Email is
  // exempt (it waits in the inbox). Demo orgs are never blocked. An explicit
  // emergency override skips the guard (audited on each send below).
  if (opts.channel === "SMS" && !emergency) {
    const org = await prisma.org.findUnique({
      where: { id: opts.orgId },
      select: { mode: true, quietStart: true, quietEnd: true, timezone: true },
    });
    if (org && org.mode !== "DEMO") {
      const quiet = shouldDeferForQuietHours({
        now,
        quietStart: org.quietStart,
        quietEnd: org.quietEnd,
        timeZone: org.timezone,
      });
      if (quiet.defer) {
        const resume = quiet.sendAt.toLocaleString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: org.timezone,
        });
        return {
          sent: 0,
          skipped: 0,
          blocked: `It's quiet hours for your leads — texting resumes at ${resume}. Send by email, wait, or mark this an emergency to send now.`,
        };
      }
    }
  }

  const where = segmentWhere(opts.orgId, opts.segment);
  const leads = await prisma.lead.findMany({
    where,
    select: {
      id: true,
      phone: true,
      email: true,
      smsConsent: true,
      emailConsent: true,
      smsStoppedAt: true,
      unsubscribedAt: true,
    },
    take: CAP,
    orderBy: { updatedAt: "asc" },
  });

  let sent = 0;
  let skipped = 0;
  for (const lead of leads) {
    // Only send on the chosen channel if this lead is reachable there.
    const reachable = bestChannelMatches(lead, opts.channel);
    if (!reachable) {
      skipped++;
      continue;
    }
    const r = await deliverToLead({
      orgId: opts.orgId,
      leadId: lead.id,
      channel: opts.channel,
      subject: opts.subject,
      body: opts.message,
      eventType: "REACTIVATED",
      eventTitle: emergency
        ? "Reactivation message sent (emergency — quiet hours bypassed)"
        : "Reactivation message sent",
      metaExtra:
        emergency && opts.channel === "SMS"
          ? { emergencyOverride: true, emergencyReason: opts.emergencyReason ?? null }
          : undefined,
      now: opts.now,
    });
    if (r.sent) sent++;
    else skipped++;
  }
  return { sent, skipped };
}

function bestChannelMatches(
  lead: Parameters<typeof bestChannel>[0],
  channel: "EMAIL" | "SMS",
): boolean {
  if (channel === "SMS") return Boolean(lead.phone && lead.smsConsent && !lead.smsStoppedAt);
  return Boolean(lead.email && lead.emailConsent && !lead.unsubscribedAt);
}
