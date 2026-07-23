"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONE: Record<string, { className?: string; style?: CSSProperties }> = {
  neutral: { className: "bg-surface-2 text-ink-2" },
  muted: { className: "bg-surface-2 text-muted" },
  accent: {
    className: "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-accent",
  },
  good: {
    style: {
      background: "color-mix(in srgb, var(--good) 15%, transparent)",
      color: "var(--good-text)",
    },
  },
  serious: {
    style: {
      background: "color-mix(in srgb, var(--serious) 15%, transparent)",
      color: "var(--serious-text)",
    },
  },
  critical: {
    style: {
      background: "color-mix(in srgb, var(--critical) 12%, transparent)",
      color: "var(--critical-text)",
    },
  },
};

export type BadgeTone = keyof typeof TONE;

/**
 * Pill badge (`rounded-pill bg-surface-2 px-2 py-0.5 text-[10px]` and friends).
 * Use `tone` for semantic coloring instead of per-page STATUS_COLOR maps —
 * see lib/status.ts for shared status→tone mappings.
 */
export function Badge({
  tone = "neutral",
  size = "sm",
  className,
  style,
  title,
  children,
}: {
  tone?: BadgeTone;
  size?: "xs" | "sm" | "md";
  className?: string;
  style?: CSSProperties;
  title?: string;
  children: ReactNode;
}) {
  const t = TONE[tone] ?? TONE.neutral!;
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-pill px-2 py-0.5",
        size === "xs" ? "text-[10px]" : size === "sm" ? "text-[11px]" : "text-xs",
        t.className,
        className,
      )}
      style={{ ...t.style, ...style }}
    >
      {children}
    </span>
  );
}
