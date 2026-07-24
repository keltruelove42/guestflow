"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { VerticalPack } from "@guestflow/shared";
import { Icon } from "@/components/ui/icons";

/** Shared lead shape used by the board and queue (subset of API response). */
export type BoardLead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  stage: string;
  source: string;
  isDemo?: boolean;
  tags: string[];
  dealValueCents: number | null;
  followUpAt: string | null;
  needsAttention: boolean;
  lastEventAt: string | null;
  latestNote?: string | null;
  property?: { name: string } | null;
  enrollments: Array<{ sequence: { name: string }; currentStep: number; status?: string }>;
  heat: { score: number; temp: "hot" | "warm" | "cold"; reasons: string[] };
  missingNextStep: boolean;
  createdAt: string;
};

const STAGE_ORDER = ["NEW", "CONTACTED", "ENGAGED", "QUOTED", "BOOKED", "LOST"];

const TEMP_DOT: Record<string, string> = {
  hot: "bg-red-500",
  warm: "bg-amber-400",
  cold: "bg-slate-300",
};

function money(cents: number | null): string | null {
  if (!cents) return null;
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

export function HeatDot({ heat }: { heat: BoardLead["heat"] }) {
  return (
    <span
      className="inline-flex items-center gap-1"
      title={`${heat.score}/100 · ${heat.reasons.join(" · ")}`}
    >
      <span className={`h-2 w-2 rounded-full ${TEMP_DOT[heat.temp]}`} />
      <span className="text-[10px] tabular-nums text-muted">{heat.score}</span>
    </span>
  );
}

/* ============================ Pipeline board ============================ */

export function LeadsBoard({
  leads,
  pack,
  onStageChange,
}: {
  leads: BoardLead[];
  pack: VerticalPack;
  onStageChange: (leadId: string, stage: string) => void;
}) {
  const router = useRouter();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

  const columns = useMemo(
    () =>
      STAGE_ORDER.map((stage) => {
        const items = leads
          .filter((l) => l.stage === stage)
          .sort((a, b) => b.heat.score - a.heat.score);
        const total = items.reduce((sum, l) => sum + (l.dealValueCents ?? 0), 0);
        return { stage, items, total };
      }),
    [leads],
  );

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
      <div className="flex min-w-[900px] gap-3">
        {columns.map((col) => (
          <div
            key={col.stage}
            className={`w-[230px] shrink-0 rounded-card border bg-surface-2/50 ${
              overStage === col.stage ? "border-accent" : "border-[var(--border)]"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setOverStage(col.stage);
            }}
            onDragLeave={() => setOverStage(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOverStage(null);
              if (dragId) onStageChange(dragId, col.stage);
              setDragId(null);
            }}
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold">
                  {pack.stageLabels[col.stage] ?? col.stage}
                </span>
                <span className="rounded-pill bg-surface-2 px-1.5 text-[10px] text-muted">
                  {col.items.length}
                </span>
              </div>
              {col.total > 0 && (
                <span className="text-[10px] font-medium tabular-nums text-ink-2">
                  {money(col.total)}
                </span>
              )}
            </div>
            <div className="min-h-[120px] space-y-2 px-2 pb-2">
              {col.items.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  draggable
                  onDragStart={() => setDragId(l.id)}
                  onDragEnd={() => setDragId(null)}
                  onClick={() => router.push(`/leads/${l.id}`)}
                  className={`w-full cursor-grab rounded-control border border-[var(--border)] bg-surface p-2.5 text-left shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing ${
                    dragId === l.id ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold">{l.name}</span>
                    <HeatDot heat={l.heat} />
                  </div>
                  <div className="mt-1 truncate text-[10px] text-muted">
                    {l.property?.name ?? l.email ?? l.phone ?? "no contact"}
                  </div>
                  {l.latestNote && (
                    <div className="mt-1.5 flex items-start gap-1 rounded-control bg-surface-2/70 px-1.5 py-1 text-[10px] leading-snug text-ink-2">
                      <Icon name="tag" size={9} className="mt-0.5 shrink-0 text-muted" />
                      <span className="line-clamp-2">{l.latestNote}</span>
                    </div>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {money(l.dealValueCents) && (
                      <span className="rounded-pill bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
                        {money(l.dealValueCents)}
                      </span>
                    )}
                    {l.needsAttention && (
                      <span className="flex items-center gap-1 rounded-pill bg-[color-mix(in_srgb,var(--serious)_20%,transparent)] px-1.5 py-0.5 text-[10px]">
                        <Icon name="message" size={9} /> reply
                      </span>
                    )}
                    {l.enrollments[0] && !l.needsAttention && (
                      <span className="flex items-center gap-1 rounded-pill bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">
                        <Icon name="repeat" size={9} /> step {l.enrollments[0].currentStep + 1}
                      </span>
                    )}
                    {l.missingNextStep && (
                      <span className="flex items-center gap-1 rounded-pill bg-[color-mix(in_srgb,var(--critical)_15%,transparent)] px-1.5 py-0.5 text-[10px]">
                        <Icon name="alert" size={9} /> no next step
                      </span>
                    )}
                    {l.tags.slice(0, 2).map((t) => (
                      <span
                        key={t}
                        className="rounded-pill bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
              {col.items.length === 0 && (
                <div className="rounded-control border border-dashed border-[var(--border)] px-2 py-4 text-center text-[10px] text-muted">
                  Drop here
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================ Work Today queue ============================ */

export function LeadsToday({
  leads,
  onSnooze,
}: {
  leads: BoardLead[];
  onSnooze: (leadId: string, days: number) => void;
}) {
  const router = useRouter();
  const queue = useMemo(
    () =>
      leads
        .filter((l) => l.stage !== "BOOKED" && l.stage !== "LOST")
        .sort((a, b) => b.heat.score - a.heat.score)
        .slice(0, 25),
    [leads],
  );
  const hotCount = queue.filter((l) => l.heat.temp === "hot").length;

  if (queue.length === 0) {
    return (
      <div className="rounded-card border border-[var(--border)] bg-surface p-8 text-center text-sm text-muted">
        Inbox zero. Every open lead is handled. 🏁
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-2">
        Your leads, hottest first. {hotCount > 0 ? `${hotCount} need attention now.` : "Nothing urgent."}{" "}
        Scores are transparent: hover the number to see exactly why.
      </p>
      {queue.map((l, i) => (
        <div
          key={l.id}
          className={`rounded-card border bg-surface p-4 ${
            i === 0 ? "border-accent shadow-md" : "border-[var(--border)]"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{l.name}</span>
                <HeatDot heat={l.heat} />
                {money(l.dealValueCents) && (
                  <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-[10px] font-medium">
                    {money(l.dealValueCents)}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {l.heat.reasons.slice(0, 3).map((r) => (
                  <span
                    key={r}
                    className="rounded-pill bg-surface-2 px-2 py-0.5 text-[10px] text-ink-2"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                className="rounded-control bg-accent px-3 py-1.5 text-xs font-medium text-white"
                onClick={() => router.push(`/leads/${l.id}`)}
              >
                Work this lead →
              </button>
              <button
                type="button"
                className="rounded-control border border-[var(--border)] px-2.5 py-1.5 text-xs"
                title="Snooze 2 days"
                onClick={() => onSnooze(l.id, 2)}
              >
                💤 2d
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
