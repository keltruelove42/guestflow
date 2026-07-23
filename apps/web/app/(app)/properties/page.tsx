"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useVertical } from "@/components/vertical-provider";
import { PropertyType } from "@guestflow/shared";

type Property = {
  id: string;
  name: string;
  location: string | null;
  bedrooms: number | null;
  type: string;
  photoUrl: string | null;
  imageUrl: string | null;
  description: string | null;
  knowledgeBase: string | null;
  directBookingUrl: string | null;
  leadCount: number;
  activeCampaignCount: number;
  isDemo?: boolean;
};

type AvailBlock = {
  id: string;
  startDate: string;
  endDate: string;
  kind: "BOOKED" | "BLOCKED" | "HOLD";
  note: string | null;
};

const KIND_STYLE: Record<string, { bg: string; label: string }> = {
  BOOKED: { bg: "var(--s1)", label: "Booked" },
  BLOCKED: { bg: "var(--ink-2)", label: "Blocked" },
  HOLD: { bg: "var(--s4)", label: "Hold" },
};

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function dateInRange(iso: string, start: string, end: string) {
  return iso >= start && iso <= end;
}

export default function PropertiesPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [calendarFor, setCalendarFor] = useState<Property | null>(null);

  const pack = useVertical();
  const { data: properties = [], isLoading } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const res = await fetch("/api/v1/properties");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<Property[]>;
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-sm text-ink-2">
          {`Scope campaigns, leads, and follow-ups to a ${pack.context.singular.toLowerCase()}.`} Open the calendar to see booked,
          blocked, and hold dates.
        </p>
        <button
          type="button"
          className="rounded-control bg-accent px-3 py-2 text-sm font-medium text-white"
          onClick={() => setShowAdd(true)}
        >
          {`＋ Add ${pack.context.singular.toLowerCase()}`}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && <p className="text-sm text-muted">Loading…</p>}
        {!isLoading && properties.length === 0 && (
          <p className="text-sm text-muted col-span-full">
            {`No ${pack.context.plural.toLowerCase()} yet, add your first one to get started.`}
          </p>
        )}
        {properties.map((p) => (
          <div
            key={p.id}
            className="overflow-hidden rounded-card border border-[var(--border)] bg-surface"
          >
            {p.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.imageUrl}
                alt={p.name}
                className="h-36 w-full object-cover"
                loading="lazy"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <div className="p-5">
            <div className="flex items-start gap-3">
              {!p.imageUrl && <div className="text-3xl">{p.photoUrl ?? "🏡"}</div>}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-base font-semibold">{p.name}</h2>
                  {p.isDemo && (
                    <span className="rounded-pill bg-surface-2 px-1.5 text-[10px] text-muted">
                      Demo
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-ink-2">
                  {p.location ?? "-"}
                  {p.bedrooms != null ? ` · ${p.bedrooms} BR` : ""}
                </p>
              </div>
            </div>
            {p.description && (
              <p className="mt-2 line-clamp-2 text-xs text-muted">{p.description}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-xs text-muted">
                {p.type.replaceAll("_", "-").toLowerCase()}
              </span>
              <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-xs tabular-nums text-muted">
                {p.leadCount ?? 0} leads
              </span>
              <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-xs tabular-nums text-muted">
                {p.activeCampaignCount ?? 0} active ads
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-control border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium"
                onClick={() => setCalendarFor(p)}
              >
                📅 Calendar
              </button>
              <Link
                href={`/leads?property=${p.id}`}
                className="rounded-control border border-[var(--border)] px-2.5 py-1.5 text-xs"
              >
                View leads →
              </Link>
            </div>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <AddPropertyModal
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            qc.invalidateQueries({ queryKey: ["properties"] });
          }}
        />
      )}

      {calendarFor && (
        <AvailabilityCalendar
          property={calendarFor}
          onClose={() => setCalendarFor(null)}
        />
      )}
    </div>
  );
}

function AddPropertyModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const pack = useVertical();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [bedrooms, setBedrooms] = useState(2);
  const [type, setType] = useState<string>(PropertyType.SHORT_TERM);
  const [knowledgeBase, setKnowledgeBase] = useState("");
  const [directBookingUrl, setDirectBookingUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [previewNote, setPreviewNote] = useState<string | null>(null);

  async function fetchPreview() {
    const url = directBookingUrl.trim();
    if (!url) {
      setPreviewNote("Paste your listing or booking URL above first");
      return;
    }
    setFetchingPreview(true);
    setPreviewNote(null);
    try {
      const res = await fetch("/api/v1/properties/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not fetch a preview");
      if (data.image) setImageUrl(data.image);
      if (data.description || data.title) {
        setDescription(data.description ?? data.title ?? "");
      }
      if (!name.trim() && data.title) setName(data.title);
      setPreviewNote(
        data.image
          ? "Pulled the photo and description from your listing. Edit anything below."
          : "Pulled the description, but that site did not share a photo. You can paste an image URL below.",
      );
    } catch (e) {
      setPreviewNote(e instanceof Error ? e.message : "Could not fetch a preview");
    } finally {
      setFetchingPreview(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (!name.trim()) throw new Error("Name is required");
      const res = await fetch("/api/v1/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          location: location.trim() || null,
          bedrooms,
          type,
          knowledgeBase: knowledgeBase.trim() || null,
          directBookingUrl: directBookingUrl.trim() || null,
          photoUrl: pack.context.icon,
          imageUrl: imageUrl.trim() || null,
          description: description.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          throw new Error(
            data.error ??
              "Session expired, close this, sign out, and sign back in.",
          );
        }
        throw new Error(data.error ?? "Could not add");
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-card border border-[var(--border)] bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h3 className="font-semibold">{`Add a ${pack.context.singular.toLowerCase()}`}</h3>
          <button type="button" className="text-sm text-muted" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="space-y-3 p-5">
          <Field label="Name">
            <input
              className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="e.g. Seaside Cottage"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Location">
            <input
              className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="City, State"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bedrooms">
              <input
                type="number"
                min={0}
                className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm outline-none focus:border-accent"
                value={bedrooms}
                onChange={(e) => setBedrooms(Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Rental type">
              <select
                className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm outline-none focus:border-accent"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value={PropertyType.SHORT_TERM}>Short-term</option>
                <option value={PropertyType.LONG_TERM}>Long-term</option>
                <option value={PropertyType.BOTH}>Both</option>
              </select>
            </Field>
          </div>
          <Field label="Listing / booking URL (optional)">
            <div className="flex gap-2">
              <input
                className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm outline-none focus:border-accent"
                placeholder="Airbnb, VRBO, or booking page link"
                value={directBookingUrl}
                onChange={(e) => setDirectBookingUrl(e.target.value)}
              />
              <button
                type="button"
                disabled={fetchingPreview}
                className="shrink-0 rounded-control border border-[var(--border)] px-3 py-2 text-xs font-medium disabled:opacity-60"
                onClick={fetchPreview}
              >
                {fetchingPreview ? "Fetching…" : "✨ Auto-fill"}
              </button>
            </div>
            {previewNote && (
              <p className="mt-1 text-xs text-ink-2">{previewNote}</p>
            )}
          </Field>
          {imageUrl && (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Listing thumbnail"
                className="h-16 w-24 rounded-control border border-[var(--border)] object-cover"
                onError={() => setImageUrl("")}
              />
              <button
                type="button"
                className="text-xs text-muted underline"
                onClick={() => setImageUrl("")}
              >
                Remove photo
              </button>
            </div>
          )}
          <Field label="Photo URL (optional)">
            <input
              className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="https://…/photo.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </Field>
          <Field label="Short description (optional)">
            <textarea
              className="min-h-[60px] w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="A one-or-two-line description shown on the card"
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label="FAQ / house rules (AI assistant uses this)">
            <textarea
              className="min-h-[80px] w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm outline-none focus:border-accent"
              placeholder="Pets, dock, check-in, amenities…"
              value={knowledgeBase}
              onChange={(e) => setKnowledgeBase(e.target.value)}
            />
          </Field>
          {error && <p className="text-sm text-critical">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
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
              {saving ? "Adding…" : `Add ${pack.context.singular.toLowerCase()}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-2">{label}</span>
      {children}
    </label>
  );
}

function AvailabilityCalendar({
  property,
  onClose,
}: {
  property: Property;
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
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/properties/${property.id}/availability?month=${month}`,
      );
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ blocks: AvailBlock[] }>;
    },
  });

  const blocks = data?.blocks ?? [];

  const dayStatus = useMemo(() => {
    const map = new Map<string, AvailBlock>();
    const total = daysInMonth(year, monthIndex);
    for (let day = 1; day <= total; day++) {
      const iso = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const hit = blocks.find((b) => dateInRange(iso, b.startDate, b.endDate));
      if (hit) map.set(iso, hit);
    }
    return map;
  }, [blocks, year, monthIndex]);

  const addBlock = useMutation({
    mutationFn: async (payload: {
      startDate: string;
      endDate: string;
      kind: string;
      note?: string;
    }) => {
      const res = await fetch(`/api/v1/properties/${property.id}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["availability", property.id] });
      setSelectStart(null);
      setNote("");
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const removeBlock = useMutation({
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
      if (confirm(`Remove ${KIND_STYLE[existing.kind]?.label ?? existing.kind} block (${existing.startDate} → ${existing.endDate})?`)) {
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

  const firstDow = new Date(year, monthIndex, 1).getDay(); // 0 Sun
  const totalDays = daysInMonth(year, monthIndex);
  const cells: Array<string | null> = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => {
      const day = i + 1;
      return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }),
  ];

  const monthLabel = cursor.toLocaleString("en-US", { month: "long", year: "numeric" });

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
                style={kind === k ? { background: KIND_STYLE[k]!.bg } : undefined}
              >
                {KIND_STYLE[k]!.label}
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
                    title={block ? `${KIND_STYLE[block.kind]?.label}: ${block.note ?? ""}` : "Available"}
                    onClick={() => onDayClick(iso)}
                    className={`relative aspect-square rounded-control text-xs tabular-nums transition-colors ${
                      block
                        ? "text-white"
                        : isStart
                          ? "ring-2 ring-accent bg-surface-2"
                          : "bg-page hover:bg-surface-2 text-ink"
                    }`}
                    style={block ? { background: KIND_STYLE[block.kind]?.bg } : undefined}
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
            {Object.entries(KIND_STYLE).map(([k, v]) => (
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
                      style={{ background: KIND_STYLE[b.kind]?.bg }}
                    />
                    {b.startDate}
                    {b.endDate !== b.startDate ? ` → ${b.endDate}` : ""} ·{" "}
                    {KIND_STYLE[b.kind]?.label}
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
