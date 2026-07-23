/**
 * Analytics catalog — the "track everything" surface for the custom report
 * builder (Growth/Enterprise). Every metric a LeadCoda customer could want to
 * chart is declared here, along with which dimensions it can be grouped by and
 * how it's aggregated. The builder UI reads this catalog to populate its
 * dropdowns, so adding a new metric is a one-line change here + a case in the
 * query engine — the UI grows automatically.
 *
 * As new data sources sync (e.g. Hostfully/Hostaway PMS bookings, occupancy),
 * their fields land on the same Booking/Lead/Event tables and become new
 * catalog entries — nothing about the builder changes.
 */

/** Base table a metric is computed from. */
export type MetricSource =
  | "lead" // Lead rows
  | "event" // LeadEvent rows (the universal activity stream)
  | "booking" // Booking rows (incl. PMS-synced)
  | "campaign" // Campaign rows (ad spend/impressions/clicks)
  | "appointment"; // Appointment rows

export type Aggregation = "count" | "countLeads" | "sum" | "rate";

/** How a metric is reduced. `rate` = numerator/denominator of two other metrics. */
export type MetricDef = {
  id: string;
  label: string;
  group: string; // UI section: Leads / Messaging / Conversion / Advertising / Appointments
  source: MetricSource;
  agg: Aggregation;
  /** For event metrics: which LeadEvent types count. */
  eventTypes?: string[];
  /** For event metrics that must also match a channel (EMAIL/SMS). */
  channel?: "EMAIL" | "SMS";
  /** For sum metrics: the integer-cents (or count) column summed. */
  field?: string;
  /** For rate metrics: numerator & denominator metric ids; formatted as %. */
  rate?: { numerator: string; denominator: string };
  /** Cents metrics render as currency; rates as %; else plain counts. */
  unit: "count" | "currency" | "percent";
  /** Dimensions this metric can be grouped by (ids from DIMENSIONS). */
  dimensions: string[];
  description: string;
};

export type DimensionDef = {
  id: string;
  label: string;
  /** "time" buckets by date; others are categorical fields. */
  kind: "time" | "category";
};

export const DIMENSIONS: DimensionDef[] = [
  { id: "time", label: "Over time", kind: "time" },
  { id: "source", label: "Lead source", kind: "category" },
  { id: "stage", label: "Pipeline stage", kind: "category" },
  { id: "campaign", label: "Campaign", kind: "category" },
  { id: "property", label: "Property / offering", kind: "category" },
  { id: "sequence", label: "Follow-up (touchpoint)", kind: "category" },
  { id: "platform", label: "Ad platform", kind: "category" },
  { id: "status", label: "Status", kind: "category" },
  { id: "owner", label: "Owner", kind: "category" },
  { id: "none", label: "Single total", kind: "category" },
];

const TIME = "time";
const LEAD_DIMS = [TIME, "source", "stage", "campaign", "property", "owner", "none"];
const EVENT_DIMS = [TIME, "source", "campaign", "property", "none"];
const BOOKING_DIMS = [TIME, "campaign", "sequence", "property", "none"];

export const METRICS: MetricDef[] = [
  // ── Leads ──────────────────────────────────────────────────────────────
  {
    id: "new_leads",
    label: "New leads",
    group: "Leads",
    source: "lead",
    agg: "count",
    unit: "count",
    dimensions: LEAD_DIMS,
    description: "Leads captured, by when they came in.",
  },
  {
    id: "pipeline_value",
    label: "Pipeline value",
    group: "Leads",
    source: "lead",
    agg: "sum",
    field: "dealValueCents",
    unit: "currency",
    dimensions: ["stage", "source", "campaign", "property", "owner", "none"],
    description: "Sum of open deal values.",
  },
  {
    id: "leads_captured",
    label: "Captured events",
    group: "Leads",
    source: "event",
    agg: "count",
    eventTypes: ["CAPTURED"],
    unit: "count",
    dimensions: EVENT_DIMS,
    description: "Lead-capture events from ads, forms and imports.",
  },
  {
    id: "inquiries_abandoned",
    label: "Abandoned inquiries",
    group: "Leads",
    source: "event",
    agg: "count",
    eventTypes: ["INQUIRY_ABANDONED"],
    unit: "count",
    dimensions: EVENT_DIMS,
    description: "Inquiries that stalled and became recoverable leads.",
  },
  // ── Messaging & engagement ─────────────────────────────────────────────
  {
    id: "emails_sent",
    label: "Emails sent",
    group: "Messaging",
    source: "event",
    agg: "count",
    eventTypes: ["EMAIL_SENT", "MANUAL_MESSAGE", "AI_REPLY_SENT"],
    channel: "EMAIL",
    unit: "count",
    dimensions: EVENT_DIMS,
    description: "Automated, manual and AI emails sent.",
  },
  {
    id: "sms_sent",
    label: "Texts sent",
    group: "Messaging",
    source: "event",
    agg: "count",
    eventTypes: ["SMS_SENT", "MANUAL_MESSAGE", "AI_REPLY_SENT"],
    channel: "SMS",
    unit: "count",
    dimensions: EVENT_DIMS,
    description: "Automated, manual and AI texts sent.",
  },
  {
    id: "emails_opened",
    label: "Emails opened",
    group: "Messaging",
    source: "event",
    agg: "count",
    eventTypes: ["EMAIL_OPENED"],
    unit: "count",
    dimensions: EVENT_DIMS,
    description: "Email opens (requires Resend open tracking).",
  },
  {
    id: "replies",
    label: "Replies",
    group: "Messaging",
    source: "event",
    agg: "count",
    eventTypes: ["REPLIED"],
    unit: "count",
    dimensions: EVENT_DIMS,
    description: "Inbound replies captured from leads.",
  },
  {
    id: "opt_outs",
    label: "Opt-outs",
    group: "Messaging",
    source: "event",
    agg: "count",
    eventTypes: ["OPTED_OUT"],
    unit: "count",
    dimensions: EVENT_DIMS,
    description: "Unsubscribes and STOP replies.",
  },
  {
    id: "open_rate",
    label: "Open rate",
    group: "Messaging",
    source: "event",
    agg: "rate",
    rate: { numerator: "emails_opened", denominator: "emails_sent" },
    unit: "percent",
    dimensions: EVENT_DIMS,
    description: "Opens ÷ emails sent.",
  },
  {
    id: "reply_rate",
    label: "Reply rate",
    group: "Messaging",
    source: "event",
    agg: "rate",
    rate: { numerator: "replies", denominator: "emails_sent" },
    unit: "percent",
    dimensions: EVENT_DIMS,
    description: "Replies ÷ emails sent.",
  },
  // ── Conversion & revenue ───────────────────────────────────────────────
  {
    id: "bookings",
    label: "Bookings",
    group: "Conversion",
    source: "booking",
    agg: "count",
    unit: "count",
    dimensions: BOOKING_DIMS,
    description: "Confirmed bookings, attributable by campaign or touchpoint.",
  },
  {
    id: "booking_revenue",
    label: "Booking revenue",
    group: "Conversion",
    source: "booking",
    agg: "sum",
    field: "amountCents",
    unit: "currency",
    dimensions: BOOKING_DIMS,
    description: "Revenue from confirmed bookings.",
  },
  {
    id: "avg_booking_value",
    label: "Avg booking value",
    group: "Conversion",
    source: "booking",
    agg: "rate",
    rate: { numerator: "booking_revenue", denominator: "bookings" },
    unit: "currency",
    dimensions: BOOKING_DIMS,
    description: "Booking revenue ÷ bookings.",
  },
  {
    id: "code_redemptions",
    label: "Code redemptions",
    group: "Conversion",
    source: "event",
    agg: "count",
    eventTypes: ["CODE_REDEEMED"],
    unit: "count",
    dimensions: EVENT_DIMS,
    description: "Discount / promo codes redeemed by leads.",
  },
  {
    id: "booking_conversion",
    label: "Lead→booking rate",
    group: "Conversion",
    source: "booking",
    agg: "rate",
    rate: { numerator: "bookings", denominator: "new_leads" },
    unit: "percent",
    dimensions: [TIME, "source", "campaign", "property", "none"],
    description: "Bookings ÷ new leads.",
  },
  // ── Advertising / cost ─────────────────────────────────────────────────
  {
    id: "ad_spend",
    label: "Ad spend",
    group: "Advertising",
    source: "campaign",
    agg: "sum",
    field: "spendCents",
    unit: "currency",
    dimensions: ["campaign", "platform", "none"],
    description: "Total ad spend across campaigns.",
  },
  {
    id: "impressions",
    label: "Impressions",
    group: "Advertising",
    source: "campaign",
    agg: "sum",
    field: "impressions",
    unit: "count",
    dimensions: ["campaign", "platform", "none"],
    description: "Ad impressions.",
  },
  {
    id: "clicks",
    label: "Clicks",
    group: "Advertising",
    source: "campaign",
    agg: "sum",
    field: "clicks",
    unit: "count",
    dimensions: ["campaign", "platform", "none"],
    description: "Ad clicks.",
  },
  {
    id: "cost_per_lead",
    label: "Cost per lead",
    group: "Advertising",
    source: "campaign",
    agg: "rate",
    rate: { numerator: "ad_spend", denominator: "campaign_leads" },
    unit: "currency",
    dimensions: ["campaign", "platform", "none"],
    description: "Ad spend ÷ leads driven.",
  },
  {
    id: "campaign_leads",
    label: "Campaign leads",
    group: "Advertising",
    source: "campaign",
    agg: "sum",
    field: "leadsCount",
    unit: "count",
    dimensions: ["campaign", "platform", "none"],
    description: "Leads attributed to campaigns (reported by the ad platform).",
  },
  // ── Appointments ───────────────────────────────────────────────────────
  {
    id: "appointments",
    label: "Appointments",
    group: "Appointments",
    source: "appointment",
    agg: "count",
    unit: "count",
    dimensions: [TIME, "status", "none"],
    description: "Scheduled appointments.",
  },
  {
    id: "appointment_show_rate",
    label: "Show rate",
    group: "Appointments",
    source: "appointment",
    agg: "rate",
    rate: { numerator: "appointments_completed", denominator: "appointments_held" },
    unit: "percent",
    dimensions: [TIME, "none"],
    description: "Completed ÷ (completed + no-show).",
  },
];

export function metricById(id: string): MetricDef | undefined {
  return METRICS.find((m) => m.id === id);
}

export function dimensionById(id: string): DimensionDef | undefined {
  return DIMENSIONS.find((d) => d.id === id);
}

/** Public catalog payload for the builder UI. */
export function analyticsCatalog() {
  return {
    metrics: METRICS.map((m) => ({
      id: m.id,
      label: m.label,
      group: m.group,
      unit: m.unit,
      dimensions: m.dimensions,
      description: m.description,
    })),
    dimensions: DIMENSIONS,
    chartTypes: ["line", "bar", "stat", "table"],
    granularities: ["day", "week", "month"],
    datePresets: [
      { id: "7d", label: "Last 7 days" },
      { id: "30d", label: "Last 30 days" },
      { id: "90d", label: "Last 90 days" },
      { id: "12mo", label: "Last 12 months" },
      { id: "all", label: "All time" },
    ],
  };
}
