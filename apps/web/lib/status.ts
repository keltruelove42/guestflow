import type { BadgeTone } from "@/components/ui/badge";

/**
 * Single source of truth for status → color/tone, replacing the per-page
 * STATUS_COLOR (campaigns), STATUS_STYLE (calendar) and KIND_STYLE (properties) maps.
 */

/** Campaign status → dot/swatch color (CSS var). */
export const CAMPAIGN_STATUS_COLOR: Record<string, string> = {
  ACTIVE: "var(--good)",
  PAUSED: "var(--serious)",
  DRAFT: "var(--muted)",
  IN_REVIEW: "var(--warn)",
  ENDED: "var(--muted)",
};

/** Appointment status → Badge tone (+ extra classes where needed). */
export const APPOINTMENT_STATUS: Record<
  string,
  { tone: BadgeTone; className?: string; label?: string }
> = {
  SCHEDULED: { tone: "accent" },
  COMPLETED: { tone: "good" },
  CANCELLED: { tone: "muted", className: "line-through" },
  NO_SHOW: { tone: "serious" },
};

/** Availability block kind → swatch color + label (properties calendar). */
export const AVAILABILITY_KIND: Record<string, { bg: string; label: string }> = {
  BOOKED: { bg: "var(--s1)", label: "Booked" },
  BLOCKED: { bg: "var(--ink-2)", label: "Blocked" },
  HOLD: { bg: "var(--s4)", label: "Hold" },
};

/** Sequence/message channel → icon. */
export const CHANNEL_ICON: Record<string, string> = {
  SMS: "💬",
  EMAIL: "✉️",
  CALL: "📞",
};
