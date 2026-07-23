/** Pure helpers for converting a step delay (stored in minutes) to and from UI forms. */

export type DelayUnit = "minutes" | "hours" | "days";

export function formatDelay(minutes: number): string {
  if (minutes === 0) return "Instant";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) {
    const h = minutes / 60;
    return `${h}h`;
  }
  const d = minutes / 1440;
  return `${d}d`;
}

export function formatDelayLong(minutes: number): string {
  if (minutes === 0) return "Instant";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) {
    const h = minutes / 60;
    return h === 1 ? "1 hour" : `${h} hours`;
  }
  const d = minutes / 1440;
  return d === 1 ? "1 day" : `${d} days`;
}

export function delayToMinutes(value: number, unit: DelayUnit): number {
  if (unit === "minutes") return value;
  if (unit === "hours") return value * 60;
  return value * 1440;
}

export function parseDelay(minutes: number): { value: number; unit: DelayUnit } {
  if (minutes === 0) return { value: 0, unit: "minutes" };
  if (minutes % 1440 === 0) return { value: minutes / 1440, unit: "days" };
  if (minutes % 60 === 0) return { value: minutes / 60, unit: "hours" };
  return { value: minutes, unit: "minutes" };
}
