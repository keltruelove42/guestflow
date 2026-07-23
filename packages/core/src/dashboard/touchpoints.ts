import { prisma } from "@guestflow/db";

/**
 * Growth-tier analytics: per-touchpoint funnel. A "touchpoint" is a sequence
 * (the unit customers edit) — for each one we report sends, opens, replies,
 * code redemptions and attributed direct bookings; campaigns get a booking
 * breakdown of their own.
 */

export type SequenceTouchpoint = {
  sequenceId: string;
  name: string;
  trigger: string;
  emailsSent: number;
  opens: number;
  openRatePct: number;
  replies: number;
  replyRatePct: number;
  redemptions: number;
  bookings: number;
  bookedRevenueCents: number;
};

export type CampaignTouchpoint = {
  campaignId: string;
  name: string;
  platform: string;
  bookings: number;
  bookedRevenueCents: number;
};

export type TouchpointAnalytics = {
  totals: {
    emailsSent: number;
    opens: number;
    openRatePct: number;
    replies: number;
    replyRatePct: number;
    redemptions: number;
    bookings: number;
  };
  sequences: SequenceTouchpoint[];
  campaigns: CampaignTouchpoint[];
};

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export async function getTouchpointAnalytics(orgId: string): Promise<TouchpointAnalytics> {
  const [sequences, bookings, campaigns] = await Promise.all([
    prisma.sequence.findMany({
      where: { orgId },
      select: {
        id: true,
        name: true,
        trigger: true,
        enrollments: { select: { leadId: true } },
      },
    }),
    prisma.booking.findMany({
      where: { orgId },
      select: {
        attributedSequenceId: true,
        attributedCampaignId: true,
        amountCents: true,
      },
    }),
    prisma.campaign.findMany({
      where: { orgId },
      select: { id: true, name: true, platform: true },
    }),
  ]);

  // Event counts grouped per lead set are expensive per-sequence; pull the
  // org's relevant events once and bucket in memory.
  const events = await prisma.leadEvent.findMany({
    where: {
      orgId,
      type: { in: ["EMAIL_SENT", "EMAIL_OPENED", "REPLIED", "CODE_REDEEMED"] },
    },
    select: { leadId: true, type: true },
  });

  const byLead = new Map<string, { sent: number; opened: number; replied: number; redeemed: number }>();
  for (const e of events) {
    const bucket = byLead.get(e.leadId) ?? { sent: 0, opened: 0, replied: 0, redeemed: 0 };
    if (e.type === "EMAIL_SENT") bucket.sent++;
    else if (e.type === "EMAIL_OPENED") bucket.opened++;
    else if (e.type === "REPLIED") bucket.replied++;
    else if (e.type === "CODE_REDEEMED") bucket.redeemed++;
    byLead.set(e.leadId, bucket);
  }

  const bookingsBySequence = new Map<string, { count: number; revenue: number }>();
  const bookingsByCampaign = new Map<string, { count: number; revenue: number }>();
  for (const b of bookings) {
    if (b.attributedSequenceId) {
      const s = bookingsBySequence.get(b.attributedSequenceId) ?? { count: 0, revenue: 0 };
      s.count++;
      s.revenue += b.amountCents ?? 0;
      bookingsBySequence.set(b.attributedSequenceId, s);
    }
    if (b.attributedCampaignId) {
      const c = bookingsByCampaign.get(b.attributedCampaignId) ?? { count: 0, revenue: 0 };
      c.count++;
      c.revenue += b.amountCents ?? 0;
      bookingsByCampaign.set(b.attributedCampaignId, c);
    }
  }

  const seqRows: SequenceTouchpoint[] = sequences.map((seq) => {
    let sent = 0,
      opened = 0,
      replied = 0,
      redeemed = 0;
    const seen = new Set<string>();
    for (const en of seq.enrollments) {
      if (seen.has(en.leadId)) continue;
      seen.add(en.leadId);
      const b = byLead.get(en.leadId);
      if (!b) continue;
      sent += b.sent;
      opened += b.opened;
      replied += Math.min(b.replied, 1); // reply rate = leads that replied
      redeemed += b.redeemed;
    }
    const booked = bookingsBySequence.get(seq.id) ?? { count: 0, revenue: 0 };
    return {
      sequenceId: seq.id,
      name: seq.name,
      trigger: seq.trigger,
      emailsSent: sent,
      opens: opened,
      openRatePct: pct(opened, sent),
      replies: replied,
      replyRatePct: pct(replied, seen.size),
      redemptions: redeemed,
      bookings: booked.count,
      bookedRevenueCents: booked.revenue,
    };
  });

  const campRows: CampaignTouchpoint[] = campaigns
    .map((c) => {
      const b = bookingsByCampaign.get(c.id) ?? { count: 0, revenue: 0 };
      return {
        campaignId: c.id,
        name: c.name,
        platform: c.platform,
        bookings: b.count,
        bookedRevenueCents: b.revenue,
      };
    })
    .filter((c) => c.bookings > 0);

  const totalSent = events.filter((e) => e.type === "EMAIL_SENT").length;
  const totalOpens = events.filter((e) => e.type === "EMAIL_OPENED").length;
  const repliedLeads = new Set(events.filter((e) => e.type === "REPLIED").map((e) => e.leadId)).size;
  const contactedLeads = new Set(events.filter((e) => e.type === "EMAIL_SENT").map((e) => e.leadId)).size;

  return {
    totals: {
      emailsSent: totalSent,
      opens: totalOpens,
      openRatePct: pct(totalOpens, totalSent),
      replies: repliedLeads,
      replyRatePct: pct(repliedLeads, contactedLeads),
      redemptions: events.filter((e) => e.type === "CODE_REDEEMED").length,
      bookings: bookings.length,
    },
    sequences: seqRows.sort((a, b) => b.bookings - a.bookings || b.emailsSent - a.emailsSent),
    campaigns: campRows.sort((a, b) => b.bookings - a.bookings),
  };
}
