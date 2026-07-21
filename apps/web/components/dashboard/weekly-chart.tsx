"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  SOURCE_LABEL,
  softSourceFill,
  sourceCssVar,
} from "@/lib/format";

const STACK_ORDER = ["META", "TIKTOK", "DIRECT_SITE", "PINTEREST"] as const;

export type WeekRow = {
  weekStart: string;
  label: string;
  META: number;
  TIKTOK: number;
  DIRECT_SITE: number;
  PINTEREST: number;
};

type Tip = {
  x: number;
  y: number;
  week: string;
  parts: Array<{ source: string; count: number }>;
  total: number;
};

export function WeeklyLeadsChart({ weeks }: { weeks: WeekRow[] }) {
  const [tip, setTip] = useState<Tip | null>(null);

  const { maxY, totals } = useMemo(() => {
    const totals = weeks.map((w) =>
      STACK_ORDER.reduce((a, s) => a + (w[s] ?? 0), 0),
    );
    const max = Math.max(4, ...totals) + 1;
    return { maxY: max, totals };
  }, [weeks]);

  const W = 640;
  const H = 220;
  const padL = 28;
  const padB = 28;
  const padT = 18;
  const gap = weeks.length ? (W - padL - 16) / weeks.length : 40;
  const bw = Math.min(28, gap * 0.55);

  const y = (v: number) => padT + (H - padB - padT) * (1 - v / maxY);

  if (weeks.length === 0) {
    return <p className="px-4 py-8 text-sm text-muted">No weekly data yet.</p>;
  }

  return (
    <div className="relative px-3 pb-3 pt-1">
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 px-1">
        {STACK_ORDER.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-[11px] text-ink-2">
            <span
              className="h-2.5 w-2.5 rounded-[3px] border"
              style={{
                background: softSourceFill(sourceCssVar(s), 48),
                borderColor: sourceCssVar(s),
              }}
            />
            {SOURCE_LABEL[s]}
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label="New leads per week by source"
        className="block"
        onMouseLeave={() => setTip(null)}
      >
        {[0, 1, 2, 3, 4].map((g) => {
          const v = Math.round((maxY * g) / 4);
          const yy = y(v);
          return (
            <g key={g}>
              <line
                x1={padL}
                x2={W - 8}
                y1={yy}
                y2={yy}
                stroke="var(--grid)"
                strokeWidth={1}
                strokeDasharray={g === 0 ? undefined : "3 4"}
              />
              <text
                x={padL - 6}
                y={yy + 3}
                textAnchor="end"
                fontSize={10}
                fill="var(--muted)"
              >
                {v}
              </text>
            </g>
          );
        })}

        {weeks.map((w, i) => {
          const cx = padL + gap * i + gap / 2;
          let acc = 0;
          const segs: ReactNode[] = [];
          for (const s of STACK_ORDER) {
            const v = w[s] ?? 0;
            if (!v) continue;
            const y0 = y(acc);
            const y1 = y(acc + v);
            const isTop = acc + v === totals[i];
            const r = isTop ? 4 : 0;
            const x0 = cx - bw / 2;
            const x1 = cx + bw / 2;
            // Soft fill + hairline source stroke (not full saturated blocks)
            const d = `M${x0},${y0} L${x0},${y1 + r} Q${x0},${y1} ${x0 + r},${y1} L${x1 - r},${y1} Q${x1},${y1} ${x1},${y1 + r} L${x1},${y0} Z`;
            segs.push(
              <path
                key={s}
                d={d}
                fill={softSourceFill(sourceCssVar(s), 46)}
                stroke={sourceCssVar(s)}
                strokeOpacity={0.45}
                strokeWidth={1}
              />,
            );
            // 2px surface gap between segments via small lift of next base
            acc += v;
            if (!isTop) {
              // visual gap: draw a surface hairline
              segs.push(
                <line
                  key={`${s}-gap`}
                  x1={x0 + 1}
                  x2={x1 - 1}
                  y1={y1}
                  y2={y1}
                  stroke="var(--surface)"
                  strokeWidth={2}
                />,
              );
            }
          }

          return (
            <g key={w.weekStart}>
              {segs}
              <text
                x={cx}
                y={y(totals[i]!) - 6}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill="var(--ink-2)"
              >
                {totals[i]}
              </text>
              <text
                x={cx}
                y={H - 8}
                textAnchor="middle"
                fontSize={10}
                fill="var(--muted)"
              >
                {w.label}
              </text>
              <rect
                x={cx - gap / 2}
                y={padT}
                width={gap}
                height={H - padB - padT}
                fill="transparent"
                className="cursor-crosshair"
                onMouseMove={(e) => {
                  setTip({
                    x: e.clientX,
                    y: e.clientY,
                    week: w.label,
                    parts: STACK_ORDER.map((s) => ({
                      source: s,
                      count: w[s] ?? 0,
                    })),
                    total: totals[i]!,
                  });
                }}
              />
            </g>
          );
        })}
      </svg>

      {tip && (
        <div
          className="pointer-events-none fixed z-50 min-w-[140px] rounded-control border border-[var(--border)] bg-surface px-3 py-2 text-xs shadow-lg"
          style={{
            left: Math.min(tip.x + 14, window.innerWidth - 180),
            top: Math.max(8, tip.y - 90),
          }}
        >
          <div className="mb-1 font-semibold text-ink">Week of {tip.week}</div>
          {tip.parts.map((p) => (
            <div
              key={p.source}
              className="flex items-center justify-between gap-4 py-0.5 text-ink-2"
            >
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-[2px] border"
                  style={{
                    background: softSourceFill(sourceCssVar(p.source), 55),
                    borderColor: sourceCssVar(p.source),
                  }}
                />
                {SOURCE_LABEL[p.source]}
              </span>
              <b className="tabular-nums text-ink">{p.count}</b>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-[var(--border)] pt-1 font-medium">
            <span>Total</span>
            <span className="tabular-nums">{tip.total}</span>
          </div>
        </div>
      )}
    </div>
  );
}
