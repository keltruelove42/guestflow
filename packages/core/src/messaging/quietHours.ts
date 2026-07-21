/**
 * Quiet hours: defer sends into the next quietEnd window.
 * quietStart/quietEnd are hours 0–23 in org local time.
 * Window can wrap midnight (default 21→9).
 */

export function isInQuietHours(
  localHour: number,
  quietStart: number,
  quietEnd: number,
): boolean {
  if (quietStart === quietEnd) return false; // disabled
  if (quietStart < quietEnd) {
    // e.g. 1–5 (unusual daytime quiet)
    return localHour >= quietStart && localHour < quietEnd;
  }
  // wraps midnight: 21–9 → quiet if hour >= 21 OR hour < 9
  return localHour >= quietStart || localHour < quietEnd;
}

/** Get local hour (0–23) for an instant in an IANA timezone. */
export function localHourInTz(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === "hour")?.value;
  return hour != null ? Number(hour) : date.getUTCHours();
}

/**
 * Next quietEnd as a Date in the given timezone, after `from`.
 * If currently in quiet hours ending at quietEnd, return that day's (or next day's) quietEnd.
 */
export function nextQuietEnd(
  from: Date,
  quietStart: number,
  quietEnd: number,
  timeZone: string,
): Date {
  // Iterate hour-by-hour until we're past quiet hours and land on quietEnd wall-clock
  // Simpler approach: find the next calendar moment when local hour === quietEnd and minute=0
  const candidate = new Date(from.getTime());
  // Cap search at 48h
  for (let i = 0; i < 48 * 60; i++) {
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
    const h = localHourInTz(candidate, timeZone);
    const m = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        minute: "numeric",
      }).formatToParts(candidate).find((p) => p.type === "minute")?.value ?? "0",
    );
    if (h === quietEnd && m === 0 && !isInQuietHours(h, quietStart, quietEnd)) {
      return new Date(candidate);
    }
    // When quietEnd itself is still "in quiet" for wrap cases — quietEnd IS the exit
    if (h === quietEnd && m === 0) {
      return new Date(candidate);
    }
  }
  // Fallback: +12h
  return new Date(from.getTime() + 12 * 60 * 60 * 1000);
}

export function shouldDeferForQuietHours(opts: {
  now: Date;
  quietStart: number;
  quietEnd: number;
  timeZone: string;
}): { defer: false } | { defer: true; sendAt: Date } {
  const hour = localHourInTz(opts.now, opts.timeZone);
  if (!isInQuietHours(hour, opts.quietStart, opts.quietEnd)) {
    return { defer: false };
  }
  return {
    defer: true,
    sendAt: nextQuietEnd(opts.now, opts.quietStart, opts.quietEnd, opts.timeZone),
  };
}
