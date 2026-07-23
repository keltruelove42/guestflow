/** Shared calendar/date helpers (previously re-implemented in calendar and properties pages). */

/** Local-timezone YYYY-MM-DD for a Date. */
export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

/** Day-of-week (0=Sun) of the 1st of the month — leading blanks in a month grid. */
export function firstWeekday(year: number, month0: number): number {
  return new Date(year, month0, 1).getDay();
}

/** ISO date string + n days → ISO date string. */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return ymd(d);
}

/** Inclusive YYYY-MM-DD range check. */
export function dateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}
