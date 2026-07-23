"use client";

import { useEffect, useRef, useState } from "react";
import { formatCents } from "@/lib/format";
import type { ChartType, Granularity, RunResult, Unit } from "./types";

/* ----------------------------- value + label formatting ---------------------------- */

/** Format a raw metric value by its unit. currency values are INTEGER CENTS. */
export function formatValue(value: number, unit: Unit): string {
  if (unit === "currency") return formatCents(Math.round(value));
  if (unit === "percent") {
    const v = Number.isInteger(value) ? value : Math.round(value * 10) / 10;
    return `${v}%`;
  }
  return Math.round(value).toLocaleString("en-US");
}

/** Prettify an ISO date bucket into a compact tick label. */
export function prettyTimeLabel(iso: string, granularity?: Granularity): string {
  // Month bucket: "2026-07"
  if (/^\d{4}-\d{2}$/.test(iso)) {
    const [y, m] = iso.split("-").map(Number);
    return new Date(y!, m! - 1, 1).toLocaleDateString("en-US", {
      month: "short",
    });
  }
  // Day / week-start bucket: "2026-07-01"
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-").map(Number);
    const label = new Date(y!, m! - 1, d!).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return granularity === "week" ? `Wk ${label}` : label;
  }
  return iso;
}

function displayLabel(
  raw: string,
  groupBy: string,
  granularity?: Granularity,
): string {
  return groupBy === "time" ? prettyTimeLabel(raw, granularity) : raw;
}

/* --------------------------------- measure hook ---------------------------------- */

function useMeasuredWidth(): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/* --------------------------------- tooltip type ---------------------------------- */

type Tip = { x: number; y: number; label: string; value: string } | null;

function Tooltip({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-control border border-[var(--border)] bg-surface px-2 py-1 text-[11px] shadow-lg"
      style={{ left: tip.x, top: tip.y - 8 }}
    >
      <div className="text-muted">{tip.label}</div>
      <div className="font-medium tabular-nums text-ink">{tip.value}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[120px] items-center justify-center text-sm text-muted">
      No data for this range
    </div>
  );
}

/* ----------------------------------- line chart ---------------------------------- */

function LineChart({
  result,
  granularity,
  height,
}: {
  result: RunResult;
  granularity?: Granularity;
  height: number;
}) {
  const [ref, measured] = useMeasuredWidth();
  const [tip, setTip] = useState<Tip>(null);

  const data = result.data;
  const values = data.map((d) => d.value);
  const maxV = Math.max(0, ...values);

  const W = measured;
  const H = height;
  const pad = { top: 14, right: 16, bottom: 26, left: 52 };
  const plotW = Math.max(0, W - pad.left - pad.right);
  const plotH = Math.max(0, H - pad.top - pad.bottom);
  const n = data.length;

  const x = (i: number) =>
    n <= 1 ? pad.left + plotW / 2 : pad.left + (i / (n - 1)) * plotW;
  // maxV guarded: when all zero, sit every point on the baseline.
  const y = (v: number) =>
    maxV <= 0 ? pad.top + plotH : pad.top + plotH - (v / maxV) * plotH;

  const points = data.map((d, i) => ({
    px: x(i),
    py: y(d.value),
    raw: d.label,
    value: d.value,
  }));

  const linePath =
    n >= 2
      ? points.map((p, i) => `${i === 0 ? "M" : "L"}${p.px},${p.py}`).join(" ")
      : "";

  const ticks = maxV <= 0 ? [0] : [0, 0.5, 1].map((r) => r * maxV);
  const showMarkers = n <= 24;
  const labelEvery = Math.max(1, Math.ceil(n / 6));

  if (!W)
    return <div ref={ref} className="w-full" style={{ height: H }} />;

  return (
    <div ref={ref} className="relative w-full">
      <svg width={W} height={H} role="img" aria-label={result.label}>
        {/* recessive gridlines + y-axis labels */}
        {ticks.map((t, i) => {
          const gy = y(t);
          return (
            <g key={i}>
              <line
                x1={pad.left}
                x2={W - pad.right}
                y1={gy}
                y2={gy}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <text
                x={pad.left - 8}
                y={gy}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                fill="var(--muted)"
              >
                {formatValue(t, result.unit)}
              </text>
            </g>
          );
        })}

        {/* series line */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* x-axis labels (sparse) */}
        {points.map((p, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text
              key={`xl-${i}`}
              x={p.px}
              y={H - 8}
              textAnchor="middle"
              fontSize={10}
              fill="var(--muted)"
            >
              {displayLabel(p.raw, result.groupBy, granularity)}
            </text>
          ) : null,
        )}

        {/* markers + oversized hit targets */}
        {points.map((p, i) => (
          <g key={`pt-${i}`}>
            {showMarkers && (
              <circle cx={p.px} cy={p.py} r={4} fill="var(--accent)" />
            )}
            <circle
              cx={p.px}
              cy={p.py}
              r={12}
              fill="transparent"
              onMouseEnter={() =>
                setTip({
                  x: p.px,
                  y: p.py,
                  label: displayLabel(p.raw, result.groupBy, granularity),
                  value: formatValue(p.value, result.unit),
                })
              }
              onMouseLeave={() => setTip(null)}
            />
          </g>
        ))}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

/* ----------------------------------- bar chart ----------------------------------- */

/** Rect anchored square on the left (baseline), rounded on the right (data) end. */
function roundedRightRect(
  bx: number,
  by: number,
  w: number,
  h: number,
  radius: number,
): string {
  const r = Math.max(0, Math.min(radius, w));
  if (w <= 0) return "";
  return [
    `M${bx},${by}`,
    `H${bx + w - r}`,
    `Q${bx + w},${by} ${bx + w},${by + r}`,
    `V${by + h - r}`,
    `Q${bx + w},${by + h} ${bx + w - r},${by + h}`,
    `H${bx}`,
    "Z",
  ].join(" ");
}

function BarChart({
  result,
  granularity,
}: {
  result: RunResult;
  granularity?: Granularity;
}) {
  const [ref, measured] = useMeasuredWidth();
  const [tip, setTip] = useState<Tip>(null);

  const data = result.data;
  const values = data.map((d) => d.value);
  const maxV = Math.max(0, ...values);

  const W = measured;
  const rowH = 34;
  const barH = 16; // 34 - 16 = 18px between bars (>= 2px surface gap)
  const pad = { top: 8, right: 66, bottom: 8, left: 116 };
  const H = data.length * rowH + pad.top + pad.bottom;
  const barAreaW = Math.max(0, W - pad.left - pad.right);
  const len = (v: number) => (maxV <= 0 ? 0 : (v / maxV) * barAreaW);

  if (!W) return <div ref={ref} className="w-full" style={{ height: H }} />;

  return (
    <div ref={ref} className="relative w-full">
      <svg width={W} height={H} role="img" aria-label={result.label}>
        {/* baseline axis */}
        <line
          x1={pad.left}
          x2={pad.left}
          y1={pad.top}
          y2={H - pad.bottom}
          stroke="var(--border)"
          strokeWidth={1}
        />
        {data.map((d, i) => {
          const cy = pad.top + i * rowH + rowH / 2;
          const barY = cy - barH / 2;
          const w = len(d.value);
          const label = displayLabel(d.label, result.groupBy, granularity);
          const valueText = formatValue(d.value, result.unit);
          return (
            <g key={i}>
              <text
                x={pad.left - 8}
                y={cy}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={11}
                fill="var(--ink-2)"
              >
                {label}
              </text>
              {w > 0 && (
                <path
                  d={roundedRightRect(pad.left, barY, w, barH, 4)}
                  fill="var(--accent)"
                />
              )}
              <text
                x={pad.left + w + 6}
                y={cy}
                dominantBaseline="middle"
                fontSize={11}
                fill="var(--ink-2)"
                className="tabular-nums"
              >
                {valueText}
              </text>
              {/* oversized row hit target */}
              <rect
                x={0}
                y={pad.top + i * rowH}
                width={W}
                height={rowH}
                fill="transparent"
                onMouseEnter={() =>
                  setTip({
                    x: pad.left + Math.max(w, 0),
                    y: barY,
                    label,
                    value: valueText,
                  })
                }
                onMouseLeave={() => setTip(null)}
              />
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

/* ----------------------------------- stat tile ----------------------------------- */

function StatTile({
  result,
  rangeLabel,
}: {
  result: RunResult;
  rangeLabel?: string;
}) {
  const sum = result.data.reduce((acc, d) => acc + d.value, 0);
  const caption = rangeLabel ? `${result.label} · ${rangeLabel}` : result.label;
  return (
    <div className="flex h-full min-h-[120px] flex-col items-start justify-center">
      <div className="text-4xl font-semibold tabular-nums text-ink">
        {formatValue(sum, result.unit)}
      </div>
      <div className="mt-1 text-xs text-muted">{caption}</div>
    </div>
  );
}

/* ------------------------------------- table ------------------------------------- */

function TableChart({
  result,
  granularity,
}: {
  result: RunResult;
  granularity?: Granularity;
}) {
  return (
    <div className="max-h-[280px] overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-xs text-muted">
            <th className="py-1.5 pr-3 font-medium">
              {result.groupBy === "time" ? "Period" : "Group"}
            </th>
            <th className="py-1.5 text-right font-medium">{result.label}</th>
          </tr>
        </thead>
        <tbody>
          {result.data.map((d, i) => (
            <tr key={i} className="border-b border-[var(--border)] last:border-0">
              <td className="py-1.5 pr-3 text-ink-2">
                {displayLabel(d.label, result.groupBy, granularity)}
              </td>
              <td className="py-1.5 text-right tabular-nums text-ink">
                {formatValue(d.value, result.unit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------- public entry --------------------------------- */

export function ReportChart({
  result,
  chart,
  granularity,
  rangeLabel,
  height = 220,
}: {
  result: RunResult | null | undefined;
  chart: ChartType;
  granularity?: Granularity;
  rangeLabel?: string;
  height?: number;
}) {
  if (!result) return <EmptyState />;
  // stat always renders (it sums); other charts need at least one row.
  if (chart !== "stat" && result.data.length === 0) return <EmptyState />;

  switch (chart) {
    case "stat":
      return <StatTile result={result} rangeLabel={rangeLabel} />;
    case "bar":
      return <BarChart result={result} granularity={granularity} />;
    case "table":
      return <TableChart result={result} granularity={granularity} />;
    case "line":
    default:
      return (
        <LineChart result={result} granularity={granularity} height={height} />
      );
  }
}
