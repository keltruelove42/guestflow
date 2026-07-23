"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { dateInRange, daysInMonth, firstWeekday, monthKey, ymd } from "@/lib/dates";
import { AVAILABILITY_KIND } from "@/lib/status";

type AvailBlock = {
  id: string;
  startDate: string;
  endDate: string;
  kind: "BOOKED" | "BLOCKED" | "HOLD";
  note: string | null;
};

export function AvailabilityCalendar({
  property,
  onClose,
}: {
  property: { id: string; name: string };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selectStart, setSelectStart] = useState<string | null>(null);
  const [kind, setKind] = useState<"BOOKED" | "BLOCKED" | "HOLD">("BLOCKED");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const month = monthKey(cursor);
  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();

  const { data, isLoading } = useQuery({
    queryKey: ["availability", property.id, month],
    queryFn: () =>
      api<{ blocks: AvailBlock[] }>(
        `/api/v1/properties/${property.id}/availability?month=${month}`,
      ),
  });

  const blocks = data?.blocks ?? [];

  const dayStatus = useMemo(() => {
    const map = new Map<string, AvailBlock>();
    const total = daysInMonth(year, monthIndex);
    for (let day = 1; day <= total; day++) {
      const iso = ymd(new Date(year, monthIndex, day));
      const hit = blocks.find((b) => dateInRange(iso, b.startDate, b.endDate));
      if (hit) map.set(iso, hit);
    }
    return map;
  }, [blocks, year, monthIndex]);

  const addBlock = useMutation({
    mutationFn: (payload: {
      startDate: string;
      endDate: string;
      kind: string;
      note?: string;
    }) =>
      api(`/api/v1/properties/${property.id}/availability`, {
        method: "POST",
        body: payload,
        errorMessage: "Failed",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["availability", property.id] });
      setSelectStart(null);
      setNote("");
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const removeBlock = useMutation({
    // Hand-rolled fetch (not api()): the endpoint replies 204 No Content, and
    // api() always parses a JSON body.
    mutationFn: async (blockId: string) => {
      const res = await fetch(
        `/api/v1/properties/${property.id}/availability/${blockId}`,
        { method: "DELETE" },
      );
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["availability", property.id] }),
  });

  function onDayClick(iso: string) {
    const existing = dayStatus.get(iso);
    if (existing) {
      if (confirm(`Remove ${AVAILABILITY_KIND[existing.kind]?.label ?? existing.kind} block (${existing.startDate} → ${existing.endDate})?`)) {
        removeBlock.mutate(existing.id);
      }
      return;
    }
    if (!selectStart) {
      setSelectStart(iso);
      return;
    }
    const start = selectStart <= iso ? selectStart : iso;
    const end = selectStart <= iso ? iso : selectStart;
    addBlock.mutate({ startDate: start, endDate: end, kind, note: note || undefined });
  }

  const cells: Array<string | null> = [
    ...Array.from({ length: firstWeekday(year, monthIndex) }, () => null),
    ...Array.from({ length: daysInMonth(year, monthIndex) }, (_, i) =>
      ymd(new Date(year, monthIndex, i + 1)),
    ),
  ];

  const monthLabel = cursor.toLocaleString("en-US", { month: "long", year: "numeric" });

  // Not the shared <Modal>/<MonthGrid>: this dialog pins its header outside a
  // scrolling max-h-[92vh] body (Modal scrolls the whole 90vh card), and the
  // weekday header row sits in its own grid with py-1 cells and a space-y-4
  // gap above the day cells — MonthGrid renders both in one gap-1 grid with
  // pb-1 headers and no way to keep the header while the days show "Loading…".
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-card border border-[var(--border)] bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h3 className="font-semibold">Availability, {property.name}</h3>
            <p className="text-xs text-muted">
              Click a free day to start a range, click again to end. Click a colored day to remove.
            </p>
          </div>
          <button type="button" className="text-sm text-muted" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="overflow-auto p-5 space-y-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="rounded-control border border-[var(--border)] px-2 py-1 text-sm"
              onClick={() => setCursor(new Date(year, monthIndex - 1, 1))}
            >
              ←
            </button>
            <div className="text-sm font-semibold">{monthLabel}</div>
            <button
              type="button"
              className="rounded-control border border-[var(--border)] px-2 py-1 text-sm"
              onClick={() => setCursor(new Date(year, monthIndex + 1, 1))}
            >
              →
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted">Mark as</span>
            {(["BOOKED", "BLOCKED", "HOLD"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-pill px-2.5 py-1 ${
                  kind === k ? "text-white" : "bg-surface-2 text-ink-2"
                }`}
                style={kind === k ? { background: AVAILABILITY_KIND[k]!.bg } : undefined}
              >
                {AVAILABILITY_KIND[k]!.label}
              </button>
            ))}
            <input
              className="min-w-[140px] flex-1 rounded-control border border-[var(--border)] bg-page px-2 py-1 text-xs"
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {selectStart && (
            <p className="text-xs text-accent">
              Range start: <b>{selectStart}</b>, click an end date
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => setSelectStart(null)}
              >
                cancel
              </button>
            </p>
          )}

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          {isLoading ? (
            <p className="text-sm text-muted">Loading calendar…</p>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {cells.map((iso, i) => {
                if (!iso) return <div key={`e-${i}`} />;
                const block = dayStatus.get(iso);
                const isStart = selectStart === iso;
                const dayNum = Number(iso.slice(-2));
                return (
                  <button
                    key={iso}
                    type="button"
                    title={block ? `${AVAILABILITY_KIND[block.kind]?.label}: ${block.note ?? ""}` : "Available"}
                    onClick={() => onDayClick(iso)}
                    className={`relative aspect-square rounded-control text-xs tabular-nums transition-colors ${
                      block
                        ? "text-white"
                        : isStart
                          ? "ring-2 ring-accent bg-surface-2"
                          : "bg-page hover:bg-surface-2 text-ink"
                    }`}
                    style={block ? { background: AVAILABILITY_KIND[block.kind]?.bg } : undefined}
                  >
                    {dayNum}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-3 text-[11px] text-ink-2">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-page border border-[var(--border)]" />{" "}
              Available
            </span>
            {Object.entries(AVAILABILITY_KIND).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: v.bg }} />{" "}
                {v.label}
              </span>
            ))}
          </div>

          {blocks.length > 0 && (
            <ul className="space-y-1.5 border-t border-[var(--border)] pt-3">
              {blocks.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-2 text-xs text-ink-2"
                >
                  <span>
                    <span
                      className="mr-1.5 inline-block h-2 w-2 rounded-full"
                      style={{ background: AVAILABILITY_KIND[b.kind]?.bg }}
                    />
                    {b.startDate}
                    {b.endDate !== b.startDate ? ` → ${b.endDate}` : ""} ·{" "}
                    {AVAILABILITY_KIND[b.kind]?.label}
                    {b.note ? `, ${b.note}` : ""}
                  </span>
                  <button
                    type="button"
                    className="text-critical"
                    onClick={() => removeBlock.mutate(b.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && <p className="text-sm text-critical">{error}</p>}
        </div>
      </div>
    </div>
  );
}
