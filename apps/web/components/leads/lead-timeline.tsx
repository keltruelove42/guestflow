"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LeadEvent, PendingMessage } from "./types";

export function eventEmoji(ev: LeadEvent): string {
  if (ev.type === "SMS_SENT" || (ev.type === "REPLIED" && ev.channel === "SMS")) return "💬";
  if (ev.type === "EMAIL_SENT") return "✉️";
  return "🕐";
}

/**
 * Activity timeline shared by the lead drawer and the lead record page.
 * The record page prefixes each title with an event emoji; the drawer does not
 * (kept as-is via `showEmoji`).
 */
export function LeadTimeline({
  events,
  showEmoji = false,
}: {
  events: LeadEvent[];
  showEmoji?: boolean;
}) {
  return (
    <ul className="space-y-3">
      {events.map((ev) => (
        <li key={ev.id} className="border-l-2 border-[var(--border)] pl-3">
          <div className="text-xs text-muted">
            {new Date(ev.occurredAt).toLocaleString()}
            {ev.meta &&
            typeof ev.meta === "object" &&
            "delivery" in ev.meta &&
            ev.meta.delivery
              ? ` · ${ev.meta.delivery}`
              : ""}
          </div>
          <div className="text-sm font-medium">
            {showEmoji ? `${eventEmoji(ev)} ${ev.title}` : ev.title}
          </div>
          {ev.body && (
            <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-xs text-ink-2">
              {ev.body}
            </p>
          )}
        </li>
      ))}
      {events.length === 0 && (
        <li className="text-xs text-muted">No activity yet.</li>
      )}
    </ul>
  );
}

/**
 * Scheduled sequence sends. The two call sites label items differently
 * (drawer: "EMAIL · Sequence · date"; record page: "✉️ in Sequence · date"),
 * so the label stays a render prop.
 */
export function PendingMessagesList({
  items,
  renderLabel,
  className,
}: {
  items: PendingMessage[];
  renderLabel: (m: PendingMessage) => ReactNode;
  className?: string;
}) {
  return (
    <ul className={cn("space-y-1.5 text-xs text-ink-2", className)}>
      {items.map((m) => (
        <li
          key={m.id}
          className="rounded-control border border-[var(--border)] px-2.5 py-1.5"
        >
          {renderLabel(m)}
        </li>
      ))}
    </ul>
  );
}
