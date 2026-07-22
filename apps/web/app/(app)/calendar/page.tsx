"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useVertical } from "@/components/vertical-provider";
import { getAppointmentTypes } from "@guestflow/shared";

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

type BookingConfig = {
  slug: string | null;
  settings: {
    enabled: boolean;
    slotMinutes: number;
    bufferMinutes: number;
    startHour: number;
    endHour: number;
    days: number[];
  };
};

const STATUS_STYLE: Record<string, string> = {
  SCHEDULED: "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-accent",
  COMPLETED: "bg-[color-mix(in_srgb,var(--good)_18%,transparent)] text-[var(--good-text)]",
  CANCELLED: "bg-surface-2 text-muted line-through",
  NO_SHOW: "bg-[color-mix(in_srgb,var(--serious)_20%,transparent)] text-ink-2",
};

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/appointments?from=${monthStart.toISOString()}&to=${monthEnd.toISOString()}`,
      );
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<Appointment[]>;
    },
  });

  const { data: booking } = useQuery({
    queryKey: ["booking-config"],
    queryFn: async () => {
      const res = await fetch("/api/v1/org/booking");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<BookingConfig>;
    },
  });

  const patch = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const res = await fetch(`/api/v1/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Update failed");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
    onError: (e) => {
      setToast(e instanceof Error ? e.message : "Update failed");
      setTimeout(() => setToast(null), 4000);
    },
  });

  // Month grid cells (leading blanks + days)
  const cells = useMemo(() => {
    const firstDow = monthStart.getDay();
    const daysInMonth = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() + 1,
      0,
    ).getDate();
    const out: Array<{ date: Date | null }> = [];
    for (let i = 0; i < firstDow; i++) out.push({ date: null });
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ date: new Date(monthStart.getFullYear(), monthStart.getMonth(), d) });
    }
    return out;
  }, [monthStart]);

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
          <button
            type="button"
            className="rounded-control border border-[var(--border)] px-3 py-2 text-sm"
            onClick={() => setSettingsOpen(true)}
          >
            🔗 Booking page
            {booking?.settings.enabled && (
              <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500" />
            )}
          </button>
          <button
            type="button"
            className="rounded-control bg-accent px-3 py-2 text-sm font-medium text-white"
            onClick={() => setCreating(true)}
          >
            ＋ New appointment
          </button>
        </div>
      </div>

      {booking?.settings.enabled && bookingUrl && (
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-[var(--border)] bg-surface px-3 py-2 text-xs">
          <span className="text-muted">Your booking link:</span>
          <code className="rounded bg-surface-2 px-2 py-0.5">{bookingUrl}</code>
          <button
            type="button"
            className="text-accent"
            onClick={() => {
              navigator.clipboard.writeText(bookingUrl);
              setToast("Booking link copied.");
              setTimeout(() => setToast(null), 2500);
            }}
          >
            Copy
          </button>
          <span className="text-muted">
            · use {"{{booking_link}}"} in any sequence step
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Month grid */}
        <div className="rounded-card border border-[var(--border)] bg-surface p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              className="rounded-control border border-[var(--border)] px-2.5 py-1 text-sm"
              onClick={() =>
                setMonthAnchor(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))
              }
            >
              ←
            </button>
            <h2 className="text-sm font-semibold">{monthLabel}</h2>
            <button
              type="button"
              className="rounded-control border border-[var(--border)] px-2.5 py-1 text-sm"
              onClick={() =>
                setMonthAnchor(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))
              }
            >
              →
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase text-muted">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, i) => {
              if (!cell.date) return <div key={`b${i}`} />;
              const key = ymd(cell.date);
              const items = byDay.get(key) ?? [];
              const isToday = key === ymd(today);
              const isSelected = key === selectedDay;
              const scheduled = items.filter((a) => a.status === "SCHEDULED").length;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(key)}
                  className={`flex min-h-[64px] flex-col items-center rounded-control border p-1.5 text-sm transition-colors ${
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
                    {cell.date.getDate()}
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
            })}
          </div>
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
                  <span className={`rounded-pill px-2 py-0.5 text-[10px] ${STATUS_STYLE[a.status]}`}>
                    {a.status.replace("_", "-").toLowerCase()}
                  </span>
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
                    <button
                      type="button"
                      className="rounded-control border border-[var(--border)] px-2 py-1 text-[11px]"
                      onClick={() => patch.mutate({ id: a.id, body: { status: "COMPLETED" } })}
                    >
                      ✓ Done
                    </button>
                    <button
                      type="button"
                      className="rounded-control border border-[var(--border)] px-2 py-1 text-[11px]"
                      onClick={() => patch.mutate({ id: a.id, body: { status: "NO_SHOW" } })}
                    >
                      👻 No-show
                    </button>
                    <button
                      type="button"
                      className="rounded-control border border-[var(--border)] px-2 py-1 text-[11px] text-critical"
                      onClick={() => patch.mutate({ id: a.id, body: { status: "CANCELLED" } })}
                    >
                      Cancel
                    </button>
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

function NewAppointmentModal({
  day,
  types,
  onClose,
  onSaved,
}: {
  day: string;
  types: Array<{ key: string; label: string; minutes: number; icon: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [typeKey, setTypeKey] = useState(types[0]?.key ?? "custom");
  const [title, setTitle] = useState(types[0]?.label ?? "");
  const [date, setDate] = useState(day);
  const [time, setTime] = useState("10:00");
  const [minutes, setMinutes] = useState(types[0]?.minutes ?? 30);
  const [leadQuery, setLeadQuery] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: leads = [] } = useQuery({
    queryKey: ["leads", null],
    queryFn: async () => {
      const res = await fetch("/api/v1/leads");
      if (!res.ok) return [];
      return res.json() as Promise<Array<{ id: string; name: string; stage: string }>>;
    },
  });

  const matches = leadQuery.trim()
    ? leads
        .filter((l) => l.name.toLowerCase().includes(leadQuery.trim().toLowerCase()))
        .slice(0, 6)
    : [];
  const selectedLead = leads.find((l) => l.id === leadId);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          typeKey,
          title: title.trim(),
          startAt: new Date(`${date}T${time}:00`).toISOString(),
          minutes,
          notes,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Could not book");
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not book");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-card border border-[var(--border)] bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h3 className="font-semibold">New appointment</h3>
          <button type="button" className="text-sm text-muted" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap gap-1.5">
            {types.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`rounded-pill px-2.5 py-1.5 text-xs ${
                  typeKey === t.key ? "bg-accent text-white" : "bg-surface-2 text-ink-2"
                }`}
                onClick={() => {
                  setTypeKey(t.key);
                  setTitle(t.label);
                  setMinutes(t.minutes);
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2">Title</label>
            <input
              className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label className="mb-1 block text-xs font-medium text-ink-2">Date</label>
              <input
                type="date"
                className="w-full rounded-control border border-[var(--border)] bg-page px-2 py-2 text-sm"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-2">Time</label>
              <input
                type="time"
                className="w-full rounded-control border border-[var(--border)] bg-page px-2 py-2 text-sm"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-2">Minutes</label>
              <input
                type="number"
                min={5}
                max={480}
                className="w-full rounded-control border border-[var(--border)] bg-page px-2 py-2 text-sm"
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value) || 30)}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2">
              Lead (optional but recommended)
            </label>
            {selectedLead ? (
              <div className="flex items-center justify-between rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm">
                <span>{selectedLead.name}</span>
                <button
                  type="button"
                  className="text-xs text-muted"
                  onClick={() => setLeadId(null)}
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <input
                  className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
                  placeholder="Search leads by name…"
                  value={leadQuery}
                  onChange={(e) => setLeadQuery(e.target.value)}
                />
                {matches.length > 0 && (
                  <div className="mt-1 overflow-hidden rounded-control border border-[var(--border)]">
                    {matches.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        className="block w-full border-b border-[var(--border)] bg-surface px-3 py-2 text-left text-sm last:border-0 hover:bg-surface-2"
                        onClick={() => {
                          setLeadId(l.id);
                          setLeadQuery("");
                        }}
                      >
                        {l.name}
                        <span className="ml-2 text-xs text-muted">{l.stage}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2">Notes</label>
            <textarea
              rows={2}
              className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-critical">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-control border border-[var(--border)] px-3 py-2 text-sm"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !title.trim()}
              className="rounded-control bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              onClick={save}
            >
              {saving ? "Booking…" : "Book it"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BookingSettingsModal({
  config,
  onClose,
}: {
  config: BookingConfig;
  onClose: () => void;
}) {
  const [enabled, setEnabled] = useState(config.settings.enabled);
  const [slug, setSlug] = useState(config.slug ?? "");
  const [slotMinutes, setSlotMinutes] = useState(config.settings.slotMinutes);
  const [bufferMinutes, setBufferMinutes] = useState(config.settings.bufferMinutes);
  const [startHour, setStartHour] = useState(config.settings.startHour);
  const [endHour, setEndHour] = useState(config.settings.endHour);
  const [days, setDays] = useState<number[]>(config.settings.days);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/org/booking", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slug || undefined,
          settings: { enabled, slotMinutes, bufferMinutes, startHour, endHour, days },
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Save failed");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-card border border-[var(--border)] bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h3 className="font-semibold">Public booking page</h3>
          <button type="button" className="text-sm text-muted" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="space-y-4 p-5">
          <label className="flex items-center justify-between gap-3 rounded-control border border-[var(--border)] bg-page px-3 py-2.5">
            <span className="text-sm">
              <span className="font-medium">Let leads book themselves</span>
              <span className="block text-xs text-muted">
                A public page where anyone picks an open slot. New bookings become leads
                automatically.
              </span>
            </span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
          </label>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2">Link name</label>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-muted">/book/</span>
              <input
                className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
                placeholder="your-business"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-2">Open from</label>
              <select
                className="w-full rounded-control border border-[var(--border)] bg-page px-2 py-2 text-sm"
                value={startHour}
                onChange={(e) => setStartHour(Number(e.target.value))}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-2">Until</label>
              <select
                className="w-full rounded-control border border-[var(--border)] bg-page px-2 py-2 text-sm"
                value={endHour}
                onChange={(e) => setEndHour(Number(e.target.value))}
              >
                {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => (
                  <option key={h} value={h}>
                    {h < 12 ? `${h} AM` : h === 12 ? "12 PM" : h === 24 ? "12 AM" : `${h - 12} PM`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-2">Slot every</label>
              <select
                className="w-full rounded-control border border-[var(--border)] bg-page px-2 py-2 text-sm"
                value={slotMinutes}
                onChange={(e) => setSlotMinutes(Number(e.target.value))}
              >
                {[15, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-2">Buffer</label>
              <select
                className="w-full rounded-control border border-[var(--border)] bg-page px-2 py-2 text-sm"
                value={bufferMinutes}
                onChange={(e) => setBufferMinutes(Number(e.target.value))}
              >
                {[0, 5, 10, 15, 30].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2">Days open</label>
            <div className="flex flex-wrap gap-1.5">
              {DAY_LABELS.map((label, d) => (
                <button
                  key={label}
                  type="button"
                  className={`rounded-pill px-2.5 py-1 text-xs ${
                    days.includes(d) ? "bg-accent text-white" : "bg-surface-2 text-ink-2"
                  }`}
                  onClick={() =>
                    setDays((prev) =>
                      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
                    )
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-critical">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-control border border-[var(--border)] px-3 py-2 text-sm"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              className="rounded-control bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              onClick={save}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
