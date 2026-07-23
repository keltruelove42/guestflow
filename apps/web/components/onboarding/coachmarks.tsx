"use client";

import { useEffect, useLayoutEffect, useMemo, useState, type CSSProperties } from "react";
import { getCoachTips } from "@/lib/onboarding";
import { useVertical } from "@/components/vertical-provider";
import { useOnboarding } from "./onboarding-provider";

type Rect = { top: number; left: number; width: number; height: number };

export function Coachmarks() {
  const { ready, local, dismissTour, nextTip, prevTip } = useOnboarding();
  const pack = useVertical();
  const tips = useMemo(() => getCoachTips(pack.context), [pack.context]);
  const [rect, setRect] = useState<Rect | null>(null);
  const [placement, setPlacement] = useState<"below" | "above" | "right">("below");

  const active =
    ready && local.tipsActive && !local.tipsDismissed && local.tipIndex < tips.length;
  const tip = active ? tips[local.tipIndex] : null;
  const isLast = local.tipIndex >= tips.length - 1;

  useLayoutEffect(() => {
    if (!tip) {
      setRect(null);
      return;
    }

    function measure() {
      const el = document.querySelector(`[data-tour="${tip!.target}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      const spaceBelow = window.innerHeight - r.bottom;
      if (spaceBelow < 160 && r.top > 180) setPlacement("above");
      else if (r.left + r.width + 320 < window.innerWidth) setPlacement("below");
      else setPlacement("below");
    }

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [tip, local.tipIndex]);

  // Auto-advance if target missing (e.g. simulate hidden in LIVE)
  useEffect(() => {
    if (!tip) return;
    const el = document.querySelector(`[data-tour="${tip.target}"]`);
    if (!el) {
      const t = window.setTimeout(() => {
        if (isLast) dismissTour();
        else nextTip();
      }, 80);
      return () => window.clearTimeout(t);
    }
  }, [tip, isLast, dismissTour, nextTip]);

  if (!tip) return null;

  const pad = 6;
  const highlight = rect
    ? {
        top: Math.max(8, rect.top - pad),
        left: Math.max(8, rect.left - pad),
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  let cardStyle: CSSProperties = { top: "30%", left: "50%", transform: "translateX(-50%)" };
  if (highlight) {
    if (placement === "above") {
      cardStyle = {
        top: highlight.top - 12,
        left: Math.min(highlight.left, window.innerWidth - 320),
        transform: "translateY(-100%)",
      };
    } else {
      cardStyle = {
        top: highlight.top + highlight.height + 12,
        left: Math.min(Math.max(12, highlight.left), window.innerWidth - 320),
      };
    }
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/35" />
      {highlight && (
        <div
          className="absolute rounded-control border-2 border-accent bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
          }}
        />
      )}

      <div
        className="pointer-events-auto absolute w-[min(100vw-1.5rem,18rem)] rounded-card border border-[var(--border)] bg-surface p-3.5 shadow-xl"
        style={cardStyle}
        role="dialog"
        aria-label={tip.title}
      >
        <div className="mb-1 flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
              Tip {local.tipIndex + 1} of {tips.length}
            </p>
            <h4 className="text-sm font-semibold">{tip.title}</h4>
          </div>
          <button
            type="button"
            aria-label="Close tips"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-ink"
            onClick={dismissTour}
          >
            ×
          </button>
        </div>
        <p className="text-xs leading-relaxed text-ink-2">{tip.body}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            className="text-xs text-muted hover:text-ink"
            onClick={dismissTour}
          >
            Skip tour
          </button>
          <div className="flex gap-1.5">
            {local.tipIndex > 0 && (
              <button
                type="button"
                className="rounded-control border border-[var(--border)] px-2.5 py-1 text-xs"
                onClick={prevTip}
              >
                Back
              </button>
            )}
            <button
              type="button"
              className="rounded-control bg-accent px-2.5 py-1 text-xs font-medium text-white"
              onClick={() => {
                if (isLast) dismissTour();
                else nextTip();
              }}
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
