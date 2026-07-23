"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/api";

export type BookingConfig = {
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

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function BookingSettingsModal({
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

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api("/api/v1/org/booking", {
        method: "PUT",
        body: {
          slug: slug || undefined,
          settings: { enabled, slotMinutes, bufferMinutes, startHour, endHour, days },
        },
        errorMessage: "Save failed",
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Public booking page" size="sm" onClose={onClose}>
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
        <Field label="Link name">
          <div className="flex items-center gap-1 text-sm">
            <span className="text-muted">/book/</span>
            <Input
              placeholder="your-business"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Open from">
            <Select
              className="px-2"
              value={startHour}
              onChange={(e) => setStartHour(Number(e.target.value))}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Until">
            <Select
              className="px-2"
              value={endHour}
              onChange={(e) => setEndHour(Number(e.target.value))}
            >
              {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => (
                <option key={h} value={h}>
                  {h < 12 ? `${h} AM` : h === 12 ? "12 PM" : h === 24 ? "12 AM" : `${h - 12} PM`}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Slot every">
            <Select
              className="px-2"
              value={slotMinutes}
              onChange={(e) => setSlotMinutes(Number(e.target.value))}
            >
              {[15, 30, 45, 60].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Buffer">
            <Select
              className="px-2"
              value={bufferMinutes}
              onChange={(e) => setBufferMinutes(Number(e.target.value))}
            >
              {[0, 5, 10, 15, 30].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Days open">
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
        </Field>
        {error && <p className="text-sm text-critical">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
