"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { SOURCE_LABEL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Toast, useToast } from "@/components/ui/toast";
import { ReportChart } from "./report-chart";
import {
  type Catalog,
  type ChartType,
  type Granularity,
  type Preset,
  type ReportSpec,
  type RunResult,
  type SavedReport,
  SOURCE_OPTIONS,
  STAGE_OPTIONS,
} from "./types";

function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

const CHART_LABEL: Record<ChartType, string> = {
  line: "Line",
  bar: "Bar",
  stat: "Stat",
  table: "Table",
};

export function ReportBuilder({
  catalog,
  initial,
  onClose,
  onSaved,
}: {
  catalog: Catalog;
  initial?: SavedReport | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast, showToast } = useToast();

  const firstMetric = catalog.metrics[0]?.id ?? "";
  const [metric, setMetric] = useState(initial?.spec.metric ?? firstMetric);
  const [groupBy, setGroupBy] = useState(initial?.spec.groupBy ?? "time");
  const [granularity, setGranularity] = useState<Granularity>(
    initial?.spec.granularity ?? "day",
  );
  const [preset, setPreset] = useState<Preset>(
    (initial?.spec.dateRange?.preset ?? "30d") as Preset,
  );
  const [source, setSource] = useState(initial?.spec.filters?.source ?? "");
  const [stage, setStage] = useState(initial?.spec.filters?.stage ?? "");
  const [chart, setChart] = useState<ChartType>(initial?.spec.chart ?? "line");
  const [name, setName] = useState(initial?.name ?? "");
  const [saving, setSaving] = useState(false);

  // Metrics grouped by `group` for the picklist optgroups.
  const metricGroups = useMemo(() => {
    const groups: Record<string, typeof catalog.metrics> = {};
    for (const m of catalog.metrics) (groups[m.group] ??= []).push(m);
    return Object.entries(groups);
  }, [catalog.metrics]);

  const currentMetric = catalog.metrics.find((m) => m.id === metric);
  const validDimIds = currentMetric?.dimensions ?? [];
  const dimOptions = catalog.dimensions.filter((d) =>
    validDimIds.includes(d.id),
  );

  // When the metric changes, drop a groupBy that the new metric can't support.
  useEffect(() => {
    if (!validDimIds.includes(groupBy)) {
      setGroupBy(validDimIds[0] ?? "none");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric]);

  const spec = useMemo<ReportSpec>(() => {
    const filters: NonNullable<ReportSpec["filters"]> = {};
    if (source) filters.source = source;
    if (stage) filters.stage = stage;
    return {
      metric,
      groupBy,
      ...(groupBy === "time" ? { granularity } : {}),
      dateRange: { preset },
      ...(Object.keys(filters).length ? { filters } : {}),
      chart,
    };
  }, [metric, groupBy, granularity, preset, source, stage, chart]);

  // Live, debounced preview.
  const [preview, setPreview] = useState<RunResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const runIdRef = useRef(0);

  useEffect(() => {
    const id = ++runIdRef.current;
    setPreviewLoading(true);
    setPreviewError(null);
    const t = setTimeout(async () => {
      try {
        const res = await api<RunResult>("/api/v1/analytics/run", {
          method: "POST",
          body: spec,
          errorMessage: "Could not run preview",
        });
        if (runIdRef.current === id) {
          setPreview(res);
          setPreviewLoading(false);
        }
      } catch (e) {
        if (runIdRef.current === id) {
          setPreviewError(
            e instanceof ApiError ? e.message : "Could not run preview",
          );
          setPreviewLoading(false);
        }
      }
    }, 400);
    return () => clearTimeout(t);
  }, [spec]);

  const rangeLabel = catalog.datePresets.find((p) => p.id === preset)?.label;

  async function save() {
    if (!name.trim()) {
      showToast("Give your report a name");
      return;
    }
    setSaving(true);
    try {
      if (initial) {
        await api<SavedReport>(`/api/v1/analytics/reports/${initial.id}`, {
          method: "PATCH",
          body: { name: name.trim(), spec },
          errorMessage: "Could not save report",
        });
      } else {
        await api<SavedReport>("/api/v1/analytics/reports", {
          method: "POST",
          body: { name: name.trim(), spec },
          errorMessage: "Could not save report",
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Could not save report");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <div className="grid gap-5 md:grid-cols-2">
        {/* Controls */}
        <div className="space-y-3">
          <Field label="Metric">
            <Select value={metric} onChange={(e) => setMetric(e.target.value)}>
              {metricGroups.map(([group, metrics]) => (
                <optgroup key={group} label={group}>
                  {metrics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>

          {currentMetric?.description && (
            <p className="-mt-1 text-xs text-muted">
              {currentMetric.description}
            </p>
          )}

          <Field label="Group by">
            <Select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
            >
              {dimOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>

          {groupBy === "time" && (
            <Field label="Granularity">
              <Select
                value={granularity}
                onChange={(e) =>
                  setGranularity(e.target.value as Granularity)
                }
              >
                {catalog.granularities.map((g) => (
                  <option key={g} value={g}>
                    {titleCase(g)}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="Date range">
            <Select
              value={preset}
              onChange={(e) => setPreset(e.target.value as Preset)}
            >
              {catalog.datePresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Source">
              <Select
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="">Any source</option>
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABEL[s] ?? titleCase(s)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Stage">
              <Select value={stage} onChange={(e) => setStage(e.target.value)}>
                <option value="">Any stage</option>
                {STAGE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {titleCase(s)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Chart type">
            <Select
              value={chart}
              onChange={(e) => setChart(e.target.value as ChartType)}
            >
              {catalog.chartTypes.map((c) => (
                <option key={c} value={c}>
                  {CHART_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {/* Preview */}
        <div className="flex flex-col">
          <div className="mb-1 text-xs font-medium text-ink-2">Preview</div>
          <div className="flex-1 rounded-card border border-[var(--border)] bg-surface p-4">
            <div className="mb-2 truncate text-sm font-semibold">
              {preview?.label ?? currentMetric?.label ?? "Report"}
            </div>
            {previewError ? (
              <div className="flex h-full min-h-[120px] items-center justify-center text-center text-sm text-critical">
                {previewError}
              </div>
            ) : previewLoading && !preview ? (
              <div className="flex h-full min-h-[120px] items-center justify-center text-sm text-muted">
                Loading preview…
              </div>
            ) : (
              <div className={previewLoading ? "opacity-60 transition-opacity" : ""}>
                <ReportChart
                  result={preview}
                  chart={chart}
                  granularity={groupBy === "time" ? granularity : undefined}
                  rangeLabel={rangeLabel}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save bar */}
      <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-[var(--border)] pt-4">
        <Field label="Report name" className="min-w-[200px] flex-1">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. New leads by week"
          />
        </Field>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : initial ? "Save changes" : "Save report"}
          </Button>
        </div>
      </div>

      <Toast message={toast} />
    </div>
  );
}
