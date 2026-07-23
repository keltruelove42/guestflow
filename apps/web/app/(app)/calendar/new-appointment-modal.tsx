"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/api";

export function NewAppointmentModal({
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
      await api("/api/v1/appointments", {
        method: "POST",
        body: {
          leadId,
          typeKey,
          title: title.trim(),
          startAt: new Date(`${date}T${time}:00`).toISOString(),
          minutes,
          notes,
        },
        errorMessage: "Could not book",
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not book");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New appointment" size="sm" onClose={onClose}>
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
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Date" className="col-span-1">
            <Input
              type="date"
              className="px-2"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Time">
            <Input
              type="time"
              className="px-2"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </Field>
          <Field label="Minutes">
            <Input
              type="number"
              min={5}
              max={480}
              className="px-2"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value) || 30)}
            />
          </Field>
        </div>
        <Field label="Lead (optional but recommended)">
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
              <Input
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
        </Field>
        <Field label="Notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-critical">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={saving || !title.trim()} onClick={save}>
            {saving ? "Booking…" : "Book it"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
