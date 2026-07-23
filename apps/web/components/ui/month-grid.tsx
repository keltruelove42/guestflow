"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { daysInMonth, firstWeekday } from "@/lib/dates";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Month grid shell shared by the Calendar page and the properties
 * AvailabilityCalendar. Renders weekday headers, leading blanks, and one
 * cell per day via `renderDay`.
 */
export function MonthGrid({
  year,
  month0,
  renderDay,
  className,
  cellClassName,
}: {
  year: number;
  /** 0-indexed month */
  month0: number;
  /** Render the contents of one day cell. */
  renderDay: (day: number, date: Date) => ReactNode;
  className?: string;
  cellClassName?: string;
}) {
  const blanks = firstWeekday(year, month0);
  const days = daysInMonth(year, month0);
  return (
    <div className={cn("grid grid-cols-7 gap-1", className)}>
      {WEEKDAYS.map((w) => (
        <div
          key={w}
          className="pb-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted"
        >
          {w}
        </div>
      ))}
      {Array.from({ length: blanks }, (_, i) => (
        <div key={`blank-${i}`} />
      ))}
      {Array.from({ length: days }, (_, i) => {
        const day = i + 1;
        return (
          <div key={day} className={cellClassName}>
            {renderDay(day, new Date(year, month0, day))}
          </div>
        );
      })}
    </div>
  );
}
