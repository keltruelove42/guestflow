/**
 * Shared types for the custom report builder + saved-report dashboard.
 * Mirrors the analytics backend contract (catalog / run / reports endpoints).
 */

export type Unit = "count" | "currency" | "percent";
export type ChartType = "line" | "bar" | "stat" | "table";
export type Granularity = "day" | "week" | "month";
export type Preset = "7d" | "30d" | "90d" | "12mo" | "all";

export type Metric = {
  id: string;
  label: string;
  group: string;
  unit: Unit;
  /** Dimension ids this metric can be grouped by. */
  dimensions: string[];
  description: string;
};

export type Dimension = {
  id: string;
  label: string;
  kind: "time" | "category";
};

export type DatePreset = { id: Preset; label: string };

export type Catalog = {
  metrics: Metric[];
  dimensions: Dimension[];
  chartTypes: ChartType[];
  granularities: Granularity[];
  datePresets: DatePreset[];
};

export type ReportSpec = {
  metric: string;
  groupBy: string;
  granularity?: Granularity;
  dateRange?: { preset?: Preset };
  filters?: {
    source?: string;
    stage?: string;
    campaignId?: string;
    propertyId?: string;
  };
  chart?: ChartType;
};

export type RunResult = {
  metric: string;
  label: string;
  unit: Unit;
  groupBy: string;
  data: { label: string; value: number }[];
};

export type SavedReport = {
  id: string;
  name: string;
  spec: ReportSpec;
  position: number;
  createdAt: string;
};

export const SOURCE_OPTIONS = [
  "META",
  "TIKTOK",
  "PINTEREST",
  "DIRECT_SITE",
  "WIFI",
  "MANUAL",
  "IMPORT",
] as const;

export const STAGE_OPTIONS = [
  "NEW",
  "CONTACTED",
  "ENGAGED",
  "QUOTED",
  "BOOKED",
  "LOST",
] as const;
