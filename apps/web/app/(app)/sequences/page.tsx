"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SequenceTrigger } from "@guestflow/shared";

type Step = {
  id?: string;
  order?: number;
  delayMinutes: number;
  channel: "EMAIL" | "SMS" | "CALL";
  subject: string | null;
  body: string;
};

type Sequence = {
  id: string;
  name: string;
  trigger: string;
  active: boolean;
  channelLabel: string;
  isDemo?: boolean;
  steps: Step[];
  stats: { enrolled: number; replies: number; replyRate: number; booked: number };
};

const TRIGGER_LABELS: Record<string, string> = {
  AD_LEAD_CAPTURED: "New lead captured from Meta, TikTok or Pinterest ad",
  INQUIRY_ABANDONED: "Inquiry on direct booking site with no booking after 1 hour",
  QUOTE_UNACCEPTED_48H: "Quote sent but not accepted within 48 hours",
  CHECKOUT_PLUS_90D: "90 days after checkout",
  MANUAL_ONLY: "Manual enrollment only",
};

function formatDelay(minutes: number): string {
  if (minutes === 0) return "Instant";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) {
    const h = minutes / 60;
    return h === 1 ? "1 hour" : `${h} hours`;
  }
  const d = minutes / 1440;
  return d === 1 ? "1 day" : `${d} days`;
}

function delayToMinutes(value: number, unit: "minutes" | "hours" | "days"): number {
  if (unit === "minutes") return value;
  if (unit === "hours") return value * 60;
  return value * 1440;
}

function parseDelay(minutes: number): { value: number; unit: "minutes" | "hours" | "days" } {
  if (minutes === 0) return { value: 0, unit: "minutes" };
  if (minutes % 1440 === 0) return { value: minutes / 1440, unit: "days" };
  if (minutes % 60 === 0) return { value: minutes / 60, unit: "hours" };
  return { value: minutes, unit: "minutes" };
}

const EMPTY_STEP: Step = {
  delayMinutes: 0,
  channel: "EMAIL",
  subject: "",
  body: "",
};

export default function SequencesPage() {
  const qc = useQueryClient();
  const [editor, setEditor] = useState<null | { mode: "create" | "edit"; seq?: Sequence }>(
    null,
  );

  const { data: sequences = [], isLoading } = useQuery({
    queryKey: ["sequences"],
    queryFn: async () => {
      const res = await fetch("/api/v1/sequences");
      if (!res.ok) throw new Error("Failed to load sequences");
      return res.json() as Promise<Sequence[]>;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const path = active ? "activate" : "pause";
      const res = await fetch(`/api/v1/sequences/${id}/${path}`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sequences"] }),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-xl text-sm leading-relaxed text-ink-2">
          Follow-ups start automatically the moment a lead is captured or an inquiry is abandoned.
          Replies pause the sequence and flag the lead for you; bookings stop it. Demo mode logs
          sends instead of delivering.
        </p>
        <button
          type="button"
          className="rounded-control bg-accent px-3 py-2 text-sm font-medium text-white"
          onClick={() => setEditor({ mode: "create" })}
        >
          ＋ New sequence
        </button>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {sequences.map((s) => (
          <article
            key={s.id}
            className="rounded-card border border-[var(--border)] bg-surface p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold">{s.name}</h2>
                  <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                    {s.channelLabel}
                  </span>
                  {s.isDemo && (
                    <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                      Demo
                    </span>
                  )}
                  <span
                    className={`rounded-pill px-2 py-0.5 text-[11px] ${
                      s.active
                        ? "bg-[color-mix(in_srgb,var(--good)_18%,transparent)] text-[var(--good-text)]"
                        : "bg-surface-2 text-muted"
                    }`}
                  >
                    {s.active ? "Active" : "Paused"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-2">
                  {TRIGGER_LABELS[s.trigger] ?? s.trigger}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="rounded-control border border-[var(--border)] px-2 py-1 text-xs"
                  onClick={() => setEditor({ mode: "edit", seq: s })}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="rounded-control border border-[var(--border)] px-2 py-1 text-xs"
                  onClick={() => toggle.mutate({ id: s.id, active: !s.active })}
                >
                  {s.active ? "Pause" : "Activate"}
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 rounded-control bg-surface-2 p-3 text-center">
              <div>
                <div className="text-lg font-semibold tabular-nums">{s.stats.enrolled}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted">Enrolled</div>
              </div>
              <div>
                <div className="text-lg font-semibold tabular-nums">
                  {s.stats.replies}
                  <span className="text-xs font-normal text-muted"> · {s.stats.replyRate}%</span>
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted">Replies</div>
              </div>
              <div>
                <div
                  className="text-lg font-semibold tabular-nums"
                  style={{ color: "var(--good-text)" }}
                >
                  {s.stats.booked}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted">Booked</div>
              </div>
            </div>

            <ol className="relative mt-4 space-y-0 border-l border-[var(--border)] pl-4">
              {s.steps.map((step, i) => (
                <li key={step.id ?? i} className="relative pb-4 last:pb-0">
                  <span className="absolute -left-[21px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-surface text-[10px]">
                    {step.channel === "SMS" ? "💬" : step.channel === "CALL" ? "📞" : "✉️"}
                  </span>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-muted">
                    Wait {formatDelay(step.delayMinutes)} · {step.channel}
                  </div>
                  <div className="mt-0.5 text-sm font-medium">
                    {step.subject ||
                      (step.channel === "SMS"
                        ? "SMS step"
                        : step.channel === "CALL"
                          ? "Call task"
                          : "Email step")}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-ink-2">{step.body}</p>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>

      {editor && (
        <SequenceEditor
          mode={editor.mode}
          initial={editor.seq}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            qc.invalidateQueries({ queryKey: ["sequences"] });
          }}
        />
      )}
    </div>
  );
}

function SequenceEditor({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  initial?: Sequence;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [trigger, setTrigger] = useState(initial?.trigger ?? SequenceTrigger.AD_LEAD_CAPTURED);
  const [steps, setSteps] = useState<Step[]>(
    initial?.steps?.length
      ? initial.steps.map((s) => ({
          delayMinutes: s.delayMinutes,
          channel: s.channel,
          subject: s.subject,
          body: s.body,
        }))
      : [{ ...EMPTY_STEP }],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const firstSmsWarn = useMemo(() => {
    const firstSms = steps.find((s) => s.channel === "SMS");
    return firstSms && !/stop/i.test(firstSms.body);
  }, [steps]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (!name.trim()) throw new Error("Name is required");
      if (steps.some((s) => !s.body.trim())) throw new Error("Every step needs a body");

      const payload = {
        name: name.trim(),
        trigger,
        steps: steps.map((s) => ({
          delayMinutes: s.delayMinutes,
          channel: s.channel,
          subject: s.channel === "SMS" ? null : s.subject,
          body: s.body,
        })),
      };

      const res =
        mode === "create"
          ? await fetch("/api/v1/sequences", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch(`/api/v1/sequences/${initial!.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Save failed");
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-card border border-[var(--border)] bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h3 className="font-semibold">
            {mode === "create" ? "New sequence" : "Edit sequence"}
          </h3>
          <button type="button" className="text-sm text-muted" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="space-y-4 p-5">
          {mode === "edit" && (
            <p className="rounded-control bg-surface-2 px-3 py-2 text-xs text-ink-2">
              Editing recomputes future scheduled sends for steps that no longer exist.
            </p>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2">Name</label>
            <input
              className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2">Trigger</label>
            <select
              className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
            >
              {Object.entries(TRIGGER_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-medium text-ink-2">Steps</div>
            {steps.map((step, i) => {
              const delay = parseDelay(step.delayMinutes);
              return (
                <div
                  key={i}
                  className="rounded-control border border-[var(--border)] bg-page p-3 space-y-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted">Step {i + 1}</span>
                    <input
                      type="number"
                      min={0}
                      className="w-20 rounded-control border border-[var(--border)] px-2 py-1 text-sm"
                      value={delay.value}
                      onChange={(e) => {
                        const value = Number(e.target.value) || 0;
                        const next = [...steps];
                        next[i] = {
                          ...step,
                          delayMinutes: delayToMinutes(value, delay.unit),
                        };
                        setSteps(next);
                      }}
                    />
                    <select
                      className="rounded-control border border-[var(--border)] px-2 py-1 text-sm"
                      value={delay.unit}
                      onChange={(e) => {
                        const unit = e.target.value as "minutes" | "hours" | "days";
                        const next = [...steps];
                        next[i] = {
                          ...step,
                          delayMinutes: delayToMinutes(delay.value, unit),
                        };
                        setSteps(next);
                      }}
                    >
                      <option value="minutes">minutes</option>
                      <option value="hours">hours</option>
                      <option value="days">days</option>
                    </select>
                    <select
                      className="rounded-control border border-[var(--border)] px-2 py-1 text-sm"
                      value={step.channel}
                      onChange={(e) => {
                        const next = [...steps];
                        next[i] = {
                          ...step,
                          channel: e.target.value as "EMAIL" | "SMS" | "CALL",
                        };
                        setSteps(next);
                      }}
                    >
                      <option value="EMAIL">Email</option>
                      <option value="SMS">SMS</option>
                      <option value="CALL">Call</option>
                    </select>
                    {steps.length > 1 && (
                      <button
                        type="button"
                        className="ml-auto text-xs text-critical"
                        onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {step.channel === "EMAIL" && (
                    <input
                      placeholder="Subject"
                      className="w-full rounded-control border border-[var(--border)] px-2 py-1.5 text-sm"
                      value={step.subject ?? ""}
                      onChange={(e) => {
                        const next = [...steps];
                        next[i] = { ...step, subject: e.target.value };
                        setSteps(next);
                      }}
                    />
                  )}
                  {step.channel === "CALL" && (
                    <input
                      placeholder="Call task title"
                      className="w-full rounded-control border border-[var(--border)] px-2 py-1.5 text-sm"
                      value={step.subject ?? ""}
                      onChange={(e) => {
                        const next = [...steps];
                        next[i] = { ...step, subject: e.target.value };
                        setSteps(next);
                      }}
                    />
                  )}
                  <textarea
                    rows={3}
                    placeholder={
                      step.channel === "CALL"
                        ? "Call script / talking points for the host"
                        : "Body - use {{first_name}} {{property}} {{host_name}} {{dates}} {{unsub_link}}"
                    }
                    className="w-full rounded-control border border-[var(--border)] px-2 py-1.5 text-sm"
                    value={step.body}
                    onChange={(e) => {
                      const next = [...steps];
                      next[i] = { ...step, body: e.target.value };
                      setSteps(next);
                    }}
                  />
                  <div className="flex flex-wrap gap-1">
                    {["first_name", "property", "host_name", "dates", "unsub_link"].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="rounded-pill bg-surface-2 px-2 py-0.5 text-[10px] text-ink-2"
                        onClick={() => {
                          const next = [...steps];
                          next[i] = { ...step, body: `${step.body}{{${tag}}}` };
                          setSteps(next);
                        }}
                      >
                        {`{{${tag}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              className="text-sm text-accent"
              onClick={() =>
                setSteps([
                  ...steps,
                  { delayMinutes: 1440, channel: "EMAIL", subject: "", body: "" },
                ])
              }
            >
              ＋ Add step
            </button>
          </div>

          {firstSmsWarn && (
            <p className="text-xs text-[var(--serious)]">
              First SMS step should include “(Reply STOP to opt out)” for TCPA compliance.
            </p>
          )}
          <p className="text-xs text-muted">
            Email steps auto-append an unsubscribe link if `{"{{unsub_link}}"}` is missing.
          </p>

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
              {saving ? "Saving…" : "Save sequence"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
