"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useVertical } from "@/components/vertical-provider";
import { getAppointmentTypes } from "@guestflow/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MonthGrid } from "@/components/ui/month-grid";
import { api } from "@/lib/api";
import { ymd } from "@/lib/dates";
import { APPOINTMENT_STATUS } from "@/lib/status";
import { NewAppointmentModal } from "./new-appointment-modal";
import { BookingSettingsModal, type BookingConfig } from "./booking-settings-modal";

type Appointment = {
  id: string;
  typeKey: string;
  title: string;
  startAt: string;
  endAt: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  notes: string | null;
  source: string;
  lead: { id: string; name: string; email: string | null; phone: string | null } | null;
};

export default function CalendarPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const pack = useVertical();
  const types = getAppointmentTypes(pack.id);

  const today = useMemo(() => new Date(), []);
  const [monthAnchor, setMonthAnchor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDay, setSelectedDay] = useState<string>(ymd(today));
  const [creating, setCreating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const monthStart = monthAnchor;
  const monthEnd = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1);

  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments", ymd(monthStart)],
    queryFn: () =>
      api<Appointment[]>(
        `/api/v1/appointments?from=${monthStart.toISOString()}&to=${monthEnd.toISOString()}`,
        { errorMessage: "Failed" },
      ),
  });

  const { data: booking } = useQuery({
    queryKey: ["booking-config"],
    queryFn: () => api<BookingConfig>("/api/v1/org/booking", { errorMessage: "Failed" }),
  });

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api(`/api/v1/appointments/${id}`, {
        method: "PATCH",
        body,
        errorMessage: "Update failed",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
    onError: (e) => {
      setToast(e instanceof Error ? e.message : "Update failed");
      setTimeout(() => setToast(null), 4000);
    },
  });

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const key = ymd(new Date(a.startAt));
      map.set(key, [...(map.get(key) ?? []), a]);
    }
    return map;
  }, [appointments]);

  const dayList = byDay.get(selectedDay) ?? [];
  const monthLabel = monthStart.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const bookingUrl = booking?.slug ? `${appUrl}/book/${booking.slug}` : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-2">
          Every appointment lands on the lead&apos;s timeline, and leads get an automatic
          reminder 24 hours before.
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setSettingsOpen(true)}>
            🔗 Booking page
            {booking?.settings.enabled && (
              <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500" />
            )}
          </Button>
          <Button variant="primary" onClick={() => setCreating(true)}>
            ＋ New appointment
          </Button>
        </div>
      </div>

      {booking?.settings.enabled && bookingUrl && (
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-[var(--border)] bg-surface px-3 py-2 text-xs">
          <span className="text-muted">Your booking link:</span>
          <code className="rounded bg-surface-2 px-2 py-0.5">{bookingUrl}</code>
          <Button
            variant="link"
            className="text-xs"
            onClick={() => {
              navigator.clipboard.writeText(bookingUrl);
              setToast("Booking link copied.");
              setTimeout(() => setToast(null), 2500);
            }}
          >
            Copy
          </Button>
          <span className="text-muted">
            · use {"{{booking_link}}"} in any sequence step
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Month grid */}
        <div className="rounded-card border border-[var(--border)] bg-surface p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <Button
              variant="ghost"
              className="px-2.5 py-1"
              onClick={() =>
                setMonthAnchor(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))
              }
            >
              ←
            </Button>
            <h2 className="text-sm font-semibold">{monthLabel}</h2>
            <Button
              variant="ghost"
              className="px-2.5 py-1"
              onClick={() =>
                setMonthAnchor(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))
              }
            >
              →
            </Button>
          </div>
          <MonthGrid
            year={monthStart.getFullYear()}
            month0={monthStart.getMonth()}
            renderDay={(_, date) => {
              const key = ymd(date);
              const items = byDay.get(key) ?? [];
              const isToday = key === ymd(today);
              const isSelected = key === selectedDay;
              const scheduled = items.filter((a) => a.status === "SCHEDULED").length;
              return (
                <button
                  type="button"
                  onClick={() => setSelectedDay(key)}
                  className={`flex min-h-[64px] w-full flex-col items-center rounded-control border p-1.5 text-sm transition-colors ${
                    isSelected
                      ? "border-accent bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]"
                      : "border-transparent hover:bg-surface-2/60"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      isToday ? "bg-accent font-bold text-white" : ""
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  {items.length > 0 && (
                    <span className="mt-1 flex flex-wrap justify-center gap-0.5">
                      {items.slice(0, 4).map((a) => (
                        <span
                          key={a.id}
                          className={`h-1.5 w-1.5 rounded-full ${
                            a.status === "SCHEDULED" ? "bg-accent" : "bg-slate-300"
                          }`}
                        />
                      ))}
                    </span>
                  )}
                  {scheduled > 0 && (
                    <span className="mt-0.5 text-[9px] text-muted">{scheduled}</span>
                  )}
                </button>
              );
            }}
          />
        </div>

        {/* Day panel */}
        <div className="rounded-card border border-[var(--border)] bg-surface p-4">
          <h3 className="text-sm font-semibold">
            {new Date(`${selectedDay}T00:00:00`).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h3>
          <div className="mt-3 space-y-2">
            {dayList.length === 0 && (
              <p className="text-xs text-muted">Nothing booked. Enjoy the quiet or fill it:</p>
            )}
            {dayList.map((a) => (
              <div
                key={a.id}
                className="rounded-control border border-[var(--border)] bg-page p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">
                    {new Date(a.startAt).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  <Badge
                    tone={APPOINTMENT_STATUS[a.status]?.tone}
                    size="xs"
                    className={APPOINTMENT_STATUS[a.status]?.className}
                  >
                    {a.status.replace("_", "-").toLowerCase()}
                  </Badge>
                </div>
                <div className="mt-1 text-sm font-medium">{a.title}</div>
                {a.lead && (
                  <button
                    type="button"
                    className="mt-0.5 text-xs text-accent hover:underline"
                    onClick={() => router.push(`/leads/${a.lead!.id}`)}
                  >
                    {a.lead.name} →
                  </button>
                )}
                {a.notes && <p className="mt-1 text-xs text-muted">{a.notes}</p>}
                {a.status === "SCHEDULED" && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-[11px]"
                      onClick={() => patch.mutate({ id: a.id, body: { status: "COMPLETED" } })}
                    >
                      ✓ Done
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-[11px]"
                      onClick={() => patch.mutate({ id: a.id, body: { status: "NO_SHOW" } })}
                    >
                      👻 No-show
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-[11px] text-critical"
                      onClick={() => patch.mutate({ id: a.id, body: { status: "CANCELLED" } })}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            ))}
            <button
              type="button"
              className="w-full rounded-control border border-dashed border-[var(--border)] py-2 text-xs text-muted hover:text-ink"
              onClick={() => setCreating(true)}
            >
              ＋ Add to this day
            </button>
          </div>
        </div>
      </div>

      {creating && (
        <NewAppointmentModal
          day={selectedDay}
          types={types}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ["appointments"] });
            setToast("Appointment booked.");
            setTimeout(() => setToast(null), 3000);
          }}
        />
      )}

      {settingsOpen && booking && (
        <BookingSettingsModal
          config={booking}
          onClose={() => {
            setSettingsOpen(false);
            qc.invalidateQueries({ queryKey: ["booking-config"] });
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-20 right-4 z-50 rounded-card border border-[var(--border)] bg-surface px-4 py-3 text-sm shadow-lg md:bottom-4">
          {toast}
        </div>
      )}
    </div>
  );
}
