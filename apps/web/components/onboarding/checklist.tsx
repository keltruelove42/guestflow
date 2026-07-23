"use client";

import Link from "next/link";
import { ONBOARDING_STEPS } from "@/lib/onboarding";
import { useOnboarding } from "./onboarding-provider";

export function OnboardingChecklist() {
  const {
    ready,
    local,
    stats,
    isDone,
    dismissChecklist,
    setChecklistMinimized,
    reopenChecklist,
  } = useOnboarding();

  if (!ready) return null;

  if (local.checklistDismissed) {
    if (stats.pct >= 100) return null;
    return (
      <button
        type="button"
        data-tour="onboarding-checklist"
        onClick={reopenChecklist}
        className="fixed bottom-4 right-4 z-[60] rounded-pill border border-[var(--border)] bg-surface px-3 py-2 text-xs font-medium shadow-lg hover:bg-surface-2"
      >
        Setup · {stats.done}/{stats.total}
      </button>
    );
  }

  if (local.checklistMinimized) {
    return (
      <button
        type="button"
        data-tour="onboarding-checklist"
        onClick={() => setChecklistMinimized(false)}
        className="fixed bottom-4 right-4 z-[60] flex items-center gap-2 rounded-pill border border-[var(--border)] bg-surface px-3 py-2 text-xs font-medium shadow-lg hover:bg-surface-2"
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: stats.pct >= 100 ? "var(--good)" : "var(--accent)" }}
        />
        Setup {stats.pct}%
      </button>
    );
  }

  const allDone = stats.pct >= 100;

  return (
    <div
      data-tour="onboarding-checklist"
      className="fixed bottom-4 right-4 z-[60] w-[min(100vw-2rem,22rem)] overflow-hidden rounded-card border border-[var(--border)] bg-surface shadow-xl"
    >
      <div className="flex items-start justify-between gap-2 border-b border-[var(--border)] px-3.5 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">
              {allDone ? "You're activated" : "Getting started"}
            </h3>
            <span className="rounded-pill bg-surface-2 px-1.5 py-0.5 text-[10px] tabular-nums text-muted">
              {stats.earned} XP
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted">
            {allDone
              ? "Nice work, checklist complete."
              : `${stats.done} of ${stats.total} · keep the streak going`}
          </p>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <button
            type="button"
            aria-label="Minimize checklist"
            className="flex h-7 w-7 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-ink"
            onClick={() => setChecklistMinimized(true)}
          >
            –
          </button>
          <button
            type="button"
            aria-label="Dismiss checklist"
            className="flex h-7 w-7 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-ink"
            onClick={dismissChecklist}
          >
            ×
          </button>
        </div>
      </div>

      <div className="px-3.5 pt-2.5">
        <div className="h-1.5 overflow-hidden rounded-pill bg-surface-2">
          <div
            className="h-full rounded-pill transition-all duration-500"
            style={{
              width: `${stats.pct}%`,
              background: allDone ? "var(--good)" : "var(--accent)",
            }}
          />
        </div>
      </div>

      <ul className="max-h-[min(50vh,22rem)] space-y-0.5 overflow-auto px-2 py-2">
        {ONBOARDING_STEPS.map((step, i) => {
          const done = isDone(step.id);
          return (
            <li key={step.id}>
              <Link
                href={step.href}
                className="flex items-start gap-2.5 rounded-control px-2 py-2 hover:bg-surface-2/80"
              >
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px]"
                  style={
                    done
                      ? {
                          background: "var(--good)",
                          borderColor: "var(--good)",
                          color: "#fff",
                        }
                      : {
                          borderColor: "var(--border)",
                          color: "var(--muted)",
                        }
                  }
                >
                  {done ? "✓" : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm font-medium ${
                      done ? "text-muted line-through decoration-[var(--muted)]" : "text-ink"
                    }`}
                  >
                    {step.title}
                  </span>
                  <span
                    className={`mt-0.5 block text-[11px] ${done ? "text-muted/80 line-through" : "text-muted"}`}
                  >
                    {step.description}
                  </span>
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-muted">
                  +{step.points}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
