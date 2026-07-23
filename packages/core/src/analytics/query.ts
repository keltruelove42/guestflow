import { prisma } from "@guestflow/db";
import { metricById, type MetricDef } from "./catalog";

/**
 * Report query engine. Turns a builder spec into a normalized series the UI
 * charts directly. One code path per base table; rate metrics divide two base
 * series. Grouping (time bucket or category) is done in memory after a single
 * filtered fetch per metric.
 */

export type DatePreset = "7d" | "30d" | "90d" | "12mo" | "all";
export type Granularity = "day" | "week" | "month";

export type ReportSpec = {
  metric: string;
  groupBy: string; // dimension id
  granularity?: Granularity;
  dateRange?: { preset?: DatePreset; from?: string; to?: string };
  filters?: {
    source?: string;
    stage?: string;
    campaignId?: string;
    propertyId?: string;
  };
  chart?: "line" | "bar" | "stat" | "table";
};

export type ReportResult = {
  metric: string;
  label: string;
  unit: "count" | "currency" | "percent";
  groupBy: string;
  /** Ordered rows: { label, value }. Time buckets are ISO dates. */
  data: Array<{ label: string; value: number }>;
};

const DAY = 86_400_000;

function resolveRange(range?: ReportSpec["dateRange"]): { from: Date | null; to: Date } {
  const to = range?.to ? new Date(range.to) : new Date();
  if (range?.from) return { from: new Date(range.from), to };
  switch (range?.preset ?? "30d") {
    case "7d":
      return { from: new Date(to.getTime() - 7 * DAY), to };
    case "30d":
      return { from: new Date(to.getTime() - 30 * DAY), to };
    case "90d":
      return { from: new Date(to.getTime() - 90 * DAY), to };
    case "12mo":
      return { from: new Date(to.getTime() - 365 * DAY), to };
    case "all":
      return { from: null, to };
    default:
      return { from: new Date(to.getTime() - 30 * DAY), to };
  }
}

function timeBucket(d: Date, g: Granularity): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  if (g === "month") return `${y}-${m}`;
  if (g === "week") {
    // ISO-ish week start (Monday)
    const day = (d.getUTCDay() + 6) % 7;
    const monday = new Date(d.getTime() - day * DAY);
    return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, "0")}-${String(monday.getUTCDate()).padStart(2, "0")}`;
  }
  return `${y}-${m}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function inc(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

/** Look up display names for id-based categories. */
async function nameMaps(orgId: string) {
  const [campaigns, properties, sequences] = await Promise.all([
    prisma.campaign.findMany({ where: { orgId }, select: { id: true, name: true, platform: true } }),
    prisma.property.findMany({ where: { orgId }, select: { id: true, name: true } }),
    prisma.sequence.findMany({ where: { orgId }, select: { id: true, name: true } }),
    ]);
  return {
    campaign: new Map(campaigns.map((c) => [c.id, c.name])),
    property: new Map(properties.map((p) => [p.id, p.name])),
    sequence: new Map(sequences.map((s) => [s.id, s.name])),
  };
}

/**
 * Compute a base (non-rate) metric grouped by the spec's dimension.
 * Returns a Map<label, value>. Internal metric ids (appointments_completed,
 * appointments_held) are supported for rate denominators.
 */
async function computeBase(
  orgId: string,
  metricId: string,
  spec: ReportSpec,
  names: Awaited<ReturnType<typeof nameMaps>>,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const { from, to } = resolveRange(spec.dateRange);
  const g = spec.granularity ?? "day";
  const dim = spec.groupBy;
  const dateFilter = from ? { gte: from, lte: to } : { lte: to };

  const def = metricById(metricId);
  const source = def?.source ?? internalSource(metricId);

  // ── LEAD ──────────────────────────────────────────────────────────────
  if (source === "lead") {
    const leads = await prisma.lead.findMany({
      where: {
        orgId,
        isDemo: false, // reports reflect real activity, never seed/demo rows
        createdAt: dateFilter,
        ...(spec.filters?.source ? { source: spec.filters.source as never } : {}),
        ...(spec.filters?.stage ? { stage: spec.filters.stage as never } : {}),
        ...(spec.filters?.campaignId ? { campaignId: spec.filters.campaignId } : {}),
        ...(spec.filters?.propertyId ? { propertyId: spec.filters.propertyId } : {}),
      },
      select: {
        createdAt: true,
        source: true,
        stage: true,
        campaignId: true,
        propertyId: true,
        ownerId: true,
        dealValueCents: true,
      },
    });
    for (const l of leads) {
      const key = leadKey(l, dim, g, names);
      inc(out, key, def?.agg === "sum" ? (l.dealValueCents ?? 0) : 1);
    }
    return out;
  }

  // ── EVENT ─────────────────────────────────────────────────────────────
  if (source === "event") {
    const eventTypes = def?.eventTypes ?? [];
    const events = await prisma.leadEvent.findMany({
      where: {
        orgId,
        occurredAt: dateFilter,
        type: { in: eventTypes as never },
        lead: { isDemo: false },
        ...(def?.channel ? { channel: def.channel } : {}),
      },
      select: {
        occurredAt: true,
        lead: { select: { source: true, campaignId: true, propertyId: true } },
      },
    });
    for (const e of events) {
      const key = eventKey(e, dim, g, names, spec);
      if (key === null) continue; // filtered out
      inc(out, key);
    }
    return out;
  }

  // ── BOOKING ───────────────────────────────────────────────────────────
  if (source === "booking") {
    const bookings = await prisma.booking.findMany({
      where: {
        orgId,
        bookedAt: dateFilter,
        lead: { isDemo: false },
        ...(spec.filters?.campaignId ? { attributedCampaignId: spec.filters.campaignId } : {}),
        ...(spec.filters?.propertyId ? { propertyId: spec.filters.propertyId } : {}),
      },
      select: {
        bookedAt: true,
        amountCents: true,
        attributedCampaignId: true,
        attributedSequenceId: true,
        propertyId: true,
      },
    });
    for (const b of bookings) {
      const key = bookingKey(b, dim, g, names);
      inc(out, key, def?.agg === "sum" ? (b.amountCents ?? 0) : 1);
    }
    return out;
  }

  // ── CAMPAIGN ──────────────────────────────────────────────────────────
  if (source === "campaign") {
    const campaigns = await prisma.campaign.findMany({
      where: { orgId, isDemo: false, ...(spec.filters?.campaignId ? { id: spec.filters.campaignId } : {}) },
      select: {
        name: true,
        platform: true,
        spendCents: true,
        impressions: true,
        clicks: true,
        leadsCount: true,
      },
    });
    const field = def?.field ?? "spendCents";
    for (const c of campaigns) {
      const key = dim === "platform" ? c.platform : dim === "none" ? "Total" : c.name;
      inc(out, key, Number((c as Record<string, unknown>)[field] ?? 0));
    }
    return out;
  }

  // ── APPOINTMENT (+ internal completed/held) ───────────────────────────
  if (source === "appointment") {
    const appts = await prisma.appointment.findMany({
      where: {
        orgId,
        startAt: dateFilter,
        // Keep real public bookings (no lead), drop demo-lead appointments.
        OR: [{ leadId: null }, { lead: { isDemo: false } }],
      },
      select: { startAt: true, status: true },
    });
    for (const a of appts) {
      if (metricId === "appointments_completed" && a.status !== "COMPLETED") continue;
      if (metricId === "appointments_held" && a.status !== "COMPLETED" && a.status !== "NO_SHOW")
        continue;
      const key =
        dim === "status" ? a.status : dim === "time" ? timeBucket(a.startAt, g) : "Total";
      inc(out, key);
    }
    return out;
  }

  return out;
}

function internalSource(metricId: string): MetricDef["source"] | undefined {
  if (metricId === "appointments_completed" || metricId === "appointments_held")
    return "appointment";
  return undefined;
}

function leadKey(
  l: {
    createdAt: Date;
    source: string;
    stage: string;
    campaignId: string | null;
    propertyId: string | null;
    ownerId: string | null;
  },
  dim: string,
  g: Granularity,
  names: Awaited<ReturnType<typeof nameMaps>>,
): string {
  switch (dim) {
    case "time":
      return timeBucket(l.createdAt, g);
    case "source":
      return l.source;
    case "stage":
      return l.stage;
    case "campaign":
      return l.campaignId ? names.campaign.get(l.campaignId) ?? "Unknown" : "No campaign";
    case "property":
      return l.propertyId ? names.property.get(l.propertyId) ?? "Unknown" : "Unassigned";
    case "owner":
      return l.ownerId ?? "Unassigned";
    default:
      return "Total";
  }
}

function eventKey(
  e: { occurredAt: Date; lead: { source: string; campaignId: string | null; propertyId: string | null } | null },
  dim: string,
  g: Granularity,
  names: Awaited<ReturnType<typeof nameMaps>>,
  spec: ReportSpec,
): string | null {
  // Apply lead-scoped filters that the event query can't express directly.
  if (spec.filters?.source && e.lead?.source !== spec.filters.source) return null;
  if (spec.filters?.campaignId && e.lead?.campaignId !== spec.filters.campaignId) return null;
  if (spec.filters?.propertyId && e.lead?.propertyId !== spec.filters.propertyId) return null;
  switch (dim) {
    case "time":
      return timeBucket(e.occurredAt, g);
    case "source":
      return e.lead?.source ?? "Unknown";
    case "campaign":
      return e.lead?.campaignId ? names.campaign.get(e.lead.campaignId) ?? "Unknown" : "No campaign";
    case "property":
      return e.lead?.propertyId ? names.property.get(e.lead.propertyId) ?? "Unknown" : "Unassigned";
    default:
      return "Total";
  }
}

function bookingKey(
  b: {
    bookedAt: Date;
    attributedCampaignId: string | null;
    attributedSequenceId: string | null;
    propertyId: string | null;
  },
  dim: string,
  g: Granularity,
  names: Awaited<ReturnType<typeof nameMaps>>,
): string {
  switch (dim) {
    case "time":
      return timeBucket(b.bookedAt, g);
    case "campaign":
      return b.attributedCampaignId
        ? names.campaign.get(b.attributedCampaignId) ?? "Unknown"
        : "Direct / none";
    case "sequence":
      return b.attributedSequenceId
        ? names.sequence.get(b.attributedSequenceId) ?? "Unknown"
        : "No follow-up";
    case "property":
      return b.propertyId ? names.property.get(b.propertyId) ?? "Unknown" : "Unassigned";
    default:
      return "Total";
  }
}

/** Sort/normalize a Map into ordered rows (time ascending; else value desc). */
function toRows(map: Map<string, number>, isTime: boolean): Array<{ label: string; value: number }> {
  const rows = [...map.entries()].map(([label, value]) => ({ label, value }));
  if (isTime) rows.sort((a, b) => a.label.localeCompare(b.label));
  else rows.sort((a, b) => b.value - a.value);
  return rows;
}

export async function runReport(orgId: string, spec: ReportSpec): Promise<ReportResult> {
  const def = metricById(spec.metric);
  if (!def) throw new Error(`Unknown metric: ${spec.metric}`);
  if (!def.dimensions.includes(spec.groupBy)) {
    throw new Error(`Metric "${def.label}" can't be grouped by that dimension`);
  }
  const isTime = spec.groupBy === "time";
  const names = await nameMaps(orgId);

  if (def.agg === "rate" && def.rate) {
    const [num, den] = await Promise.all([
      computeBase(orgId, def.rate.numerator, spec, names),
      computeBase(orgId, def.rate.denominator, spec, names),
    ]);
    const merged = new Map<string, number>();
    for (const [label, d] of den.entries()) {
      const n = num.get(label) ?? 0;
      if (d > 0) merged.set(label, def.unit === "percent" ? (n / d) * 100 : n / d);
    }
    return {
      metric: def.id,
      label: def.label,
      unit: def.unit,
      groupBy: spec.groupBy,
      data: toRows(merged, isTime).map((r) => ({
        ...r,
        value: Math.round(r.value * 10) / 10,
      })),
    };
  }

  const base = await computeBase(orgId, def.id, spec, names);
  return {
    metric: def.id,
    label: def.label,
    unit: def.unit,
    groupBy: spec.groupBy,
    data: toRows(base, isTime),
  };
}
