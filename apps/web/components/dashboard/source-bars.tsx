"use client";

import { SOURCE_LABEL, softSourceFill, sourceCssVar } from "@/lib/format";

export function SourceBars({
  rows,
}: {
  rows: Array<{ source: string; count: number }>;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));

  if (rows.length === 0) {
    return <p className="px-4 py-8 text-sm text-muted">No leads yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2.5 px-4 pb-4 pt-2">
      {rows.map((r) => {
        const pct = Math.round((100 * r.count) / max);
        const color = sourceCssVar(r.source);
        return (
          <div key={r.source} className="flex items-center gap-3">
            <span className="w-[88px] shrink-0 text-xs font-medium text-ink-2">
              {SOURCE_LABEL[r.source] ?? r.source}
            </span>
            <div className="h-3.5 flex-1 overflow-hidden rounded-[5px] bg-surface-2">
              <div
                className="h-full rounded-[5px] border transition-[width] duration-500"
                style={{
                  width: `${pct}%`,
                  background: softSourceFill(color, 50),
                  borderColor: `color-mix(in srgb, ${color} 55%, transparent)`,
                }}
              />
            </div>
            <b className="w-8 shrink-0 text-right text-xs tabular-nums text-ink">
              {r.count}
            </b>
          </div>
        );
      })}
    </div>
  );
}
