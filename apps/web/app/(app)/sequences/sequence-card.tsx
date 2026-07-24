"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { CHANNEL_ICON } from "@/lib/status";
import type { Sequence } from "@/lib/queries";
import { formatDelay, formatDelayLong } from "./delay";

export function SequenceCard({
  seq: s,
  expanded,
  onExpand,
  onEdit,
  onToggle,
}: {
  seq: Sequence;
  expanded: boolean;
  onExpand: () => void;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <article className="rounded-card border border-[var(--border)] bg-surface p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onExpand}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-semibold">{s.name}</h2>
            {s.isDemo && (
              <Badge tone="accent" size="xs">
                Template
              </Badge>
            )}
            <span
              className={`h-2 w-2 rounded-full ${s.active ? "bg-emerald-500" : "bg-slate-300"}`}
              title={s.active ? "Active" : "Paused"}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {s.steps.map((step, i) => (
              <Badge key={step.id ?? i} tone="neutral" size="xs">
                <Icon name={CHANNEL_ICON[step.channel] ?? "dot"} size={10} />
                {i === 0 && step.delayMinutes === 0 ? "Instant" : `+${formatDelay(step.delayMinutes)}`}
              </Badge>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-muted">
            {s.stats.enrolled} enrolled · {s.stats.replies} replies ({s.stats.replyRate}
            %) ·{" "}
            <span style={{ color: "var(--good-text)" }}>{s.stats.booked} booked</span>
          </div>
        </button>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="xs" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="ghost" size="xs" onClick={onToggle}>
            {s.active ? "Pause" : "Activate"}
          </Button>
        </div>
      </div>

      {expanded && (
        <ol className="relative mt-4 space-y-0 border-l border-[var(--border)] pl-4">
          {s.steps.map((step, i) => (
            <li key={step.id ?? i} className="relative pb-4 last:pb-0">
              <span className="absolute -left-[21px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-surface text-ink-2">
                <Icon name={CHANNEL_ICON[step.channel] ?? "dot"} size={10} />
              </span>
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted">
                Wait {formatDelayLong(step.delayMinutes)} · {step.channel}
              </div>
              <div className="mt-0.5 text-sm font-medium">
                {step.subject ||
                  (step.channel === "SMS"
                    ? "SMS step"
                    : step.channel === "CALL"
                      ? "Call task"
                      : "Email step")}
              </div>
              <p className="mt-0.5 whitespace-pre-line text-xs text-ink-2">{step.body}</p>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
