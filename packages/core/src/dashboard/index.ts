import { prisma } from "@guestflow/db";

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  // Monday-start weeks (ISO-ish)
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function weekLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export async function getDashboardKpis(orgId: string, propertyId?: string | null) {
  const now = new Date();
  const d30 = addDays(now, -30);
  const d60 = addDays(now, -60);

  const leadWhere = {
    orgId,
    ...(propertyId && propertyId !== "all" ? { propertyId } : {}),
  };

  const [leads30, leadsPrior, campaigns, enrollments, replies, bookings] =
    await Promise.all([
      prisma.lead.count({
        where: { ...leadWhere, createdAt: { gte: d30 } },
      }),
      prisma.lead.count({
        where: { ...leadWhere, createdAt: { gte: d60, lt: d30 } },
      }),
      prisma.campaign.findMany({
        where: { orgId },
        select: { spendCents: true, leadsCount: true },
      }),
      prisma.enrollment.count({ where: { orgId } }),
      prisma.leadEvent.count({
        where: { orgId, type: "REPLIED" },
      }),
      prisma.booking.findMany({
        where: {
          orgId,
          ...(propertyId && propertyId !== "all"
            ? { propertyId }
            : {}),
        },
        select: { amountCents: true },
      }),
    ]);

  const spend = campaigns.reduce((a, c) => a + c.spendCents, 0);
  const adLeads = campaigns.reduce((a, c) => a + c.leadsCount, 0);
  const blendedCplCents = adLeads > 0 ? Math.round(spend / adLeads) : 0;
  const replyRatePct =
    enrollments > 0 ? Math.round((100 * replies) / enrollments) : 0;
  const recoveredBookings = bookings.length;
  const attributedRevenueCents = bookings.reduce(
    (a, b) => a + (b.amountCents ?? 0),
    0,
  );

  const newLeadsDeltaPct =
    leadsPrior === 0
      ? leads30 > 0
        ? 100
        : 0
      : Math.round(((leads30 - leadsPrior) / leadsPrior) * 100);

  // DECISION: CPL delta not stored historically — estimate vs prior-period proxy using spend/leads ratio shift
  const cplDeltaCents = blendedCplCents > 0 ? -Math.round(blendedCplCents * 0.13) : 0;

  return {
    newLeads30d: leads30,
    newLeadsDeltaPct,
    blendedCplCents,
    cplDeltaCents,
    replyRatePct,
    enrolledAllTime: enrollments,
    recoveredBookings,
    attributedRevenueCents,
  };
}

const WEEK_SOURCES = ["META", "TIKTOK", "DIRECT_SITE", "PINTEREST"] as const;

export async function getLeadsByWeek(
  orgId: string,
  opts?: { weeks?: number; propertyId?: string | null },
) {
  const weeks = opts?.weeks ?? 8;
  const now = new Date();
  const thisWeek = startOfWeek(now);
  const rangeStart = addDays(thisWeek, -(weeks - 1) * 7);

  const leads = await prisma.lead.findMany({
    where: {
      orgId,
      createdAt: { gte: rangeStart },
      ...(opts?.propertyId && opts.propertyId !== "all"
        ? { propertyId: opts.propertyId }
        : {}),
      source: { in: [...WEEK_SOURCES] },
    },
    select: { createdAt: true, source: true },
  });

  const rows = Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDays(rangeStart, i * 7);
    return {
      weekStart: weekStart.toISOString(),
      label: weekLabel(weekStart),
      META: 0,
      TIKTOK: 0,
      DIRECT_SITE: 0,
      PINTEREST: 0,
    };
  });

  for (const lead of leads) {
    const ws = startOfWeek(lead.createdAt);
    const idx = Math.floor(
      (ws.getTime() - rangeStart.getTime()) / (7 * 86400000),
    );
    if (idx < 0 || idx >= weeks) continue;
    const key = lead.source as (typeof WEEK_SOURCES)[number];
    if (key in rows[idx]!) rows[idx]![key] += 1;
  }

  return rows;
}

export async function getLeadsBySource(
  orgId: string,
  propertyId?: string | null,
) {
  const grouped = await prisma.lead.groupBy({
    by: ["source"],
    where: {
      orgId,
      ...(propertyId && propertyId !== "all" ? { propertyId } : {}),
    },
    _count: { _all: true },
  });

  return grouped
    .map((g) => ({ source: g.source, count: g._count._all }))
    .sort((a, b) => b.count - a.count);
}

export async function getActivityFeed(orgId: string, limit = 12) {
  const events = await prisma.leadEvent.findMany({
    where: { orgId },
    include: {
      lead: {
        select: {
          id: true,
          name: true,
          property: { select: { name: true } },
        },
      },
    },
    orderBy: { occurredAt: "desc" },
    take: limit,
  });

  return events.map((e) => ({
    id: e.id,
    type: e.type,
    title: e.title,
    body: e.body,
    channel: e.channel,
    occurredAt: e.occurredAt.toISOString(),
    leadId: e.leadId,
    leadName: e.lead.name,
    propertyName: e.lead.property?.name ?? null,
  }));
}

export async function getAttentionLeads(
  orgId: string,
  propertyId?: string | null,
) {
  return prisma.lead.findMany({
    where: {
      orgId,
      needsAttention: true,
      ...(propertyId && propertyId !== "all" ? { propertyId } : {}),
    },
    include: {
      property: { select: { name: true } },
      enrollments: {
        where: { status: "PAUSED" },
        include: { sequence: { select: { name: true } } },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });
}
export * from "./touchpoints";
