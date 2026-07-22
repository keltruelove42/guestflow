"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useVertical } from "@/components/vertical-provider";
import { UpgradeChip } from "@/components/upgrade";
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

/** Folder definitions: one per follow-up type, in display order. */
const FOLDERS: Array<{ trigger: string; icon: string; title: string }> = [
  { trigger: "AD_LEAD_CAPTURED", icon: "⚡", title: "New lead response" },
  { trigger: "INQUIRY_ABANDONED", icon: "🛟", title: "Abandoned inquiry rescue" },
  { trigger: "QUOTE_UNACCEPTED_48H", icon: "💬", title: "Quote & offer follow-up" },
  { trigger: "CHECKOUT_PLUS_90D", icon: "🔁", title: "Rebook & win-back" },
  { trigger: "MANUAL_ONLY", icon: "✋", title: "Manual plays" },
];

function formatDelay(minutes: number): string {
  if (minutes === 0) return "Instant";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) {
    const h = minutes / 60;
    return `${h}h`;
  }
  const d = minutes / 1440;
  return `${d}d`;
}

function formatDelayLong(minutes: number): string {
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

const CHANNEL_ICON: Record<string, string> = { SMS: "💬", EMAIL: "✉️", CALL: "📞" };

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
  const [varsOpen, setVarsOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const pack = useVertical();
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

  const byTrigger = useMemo(() => {
    const map = new Map<string, Sequence[]>();
    for (const f of FOLDERS) map.set(f.trigger, []);
    for (const s of sequences) {
      const bucket = map.get(s.trigger);
      if (bucket) bucket.push(s);
      else map.set(s.trigger, [s]);
    }
    // Own sequences first inside each folder, then templates
    for (const list of map.values()) {
      list.sort((a, b) => Number(a.isDemo ?? false) - Number(b.isDemo ?? false));
    }
    return map;
  }, [sequences]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-xl text-sm leading-relaxed text-ink-2">
          {pack.copy.followupsDesc} Demo mode logs sends instead of delivering.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-control border border-[var(--border)] bg-surface px-3 py-2 text-sm font-medium"
            onClick={() => setVarsOpen(true)}
          >
            {"{ } Variables"}
          </button>
          <button
            type="button"
            className="rounded-control bg-accent px-3 py-2 text-sm font-medium text-white"
            onClick={() => setEditor({ mode: "create" })}
          >
            ＋ New sequence
          </button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}

      {!isLoading &&
        FOLDERS.map((folder) => {
          const list = byTrigger.get(folder.trigger) ?? [];
          if (list.length === 0) return null;
          const activeCount = list.filter((s) => s.active).length;
          return (
            <details
              key={folder.trigger}
              open
              className="rounded-card border border-[var(--border)] bg-surface"
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3 marker:hidden [&::-webkit-details-marker]:hidden">
                <span className="text-base">{folder.icon}</span>
                <span className="text-sm font-semibold">{folder.title}</span>
                <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                  {list.length}
                </span>
                <span className="hidden text-xs text-muted sm:inline">
                  {pack.triggerLabels[folder.trigger] ?? ""}
                </span>
                <span className="ml-auto text-[11px] text-muted">
                  {activeCount} active
                </span>
              </summary>
              <div className="grid gap-3 border-t border-[var(--border)] p-4 lg:grid-cols-2">
                {list.map((s) => (
                  <SequenceCard
                    key={s.id}
                    seq={s}
                    expanded={expanded === s.id}
                    onExpand={() => setExpanded(expanded === s.id ? null : s.id)}
                    onEdit={() => setEditor({ mode: "edit", seq: s })}
                    onToggle={() => toggle.mutate({ id: s.id, active: !s.active })}
                  />
                ))}
              </div>
            </details>
          );
        })}

      {editor && (
        <SequenceEditor
          mode={editor.mode}
          initial={editor.seq}
          triggerLabels={pack.triggerLabels}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            qc.invalidateQueries({ queryKey: ["sequences"] });
          }}
        />
      )}

      {varsOpen && <VariablesModal onClose={() => setVarsOpen(false)} />}
    </div>
  );
}

function SequenceCard({
  seq: s,
  expanded,
  onExpand,
  onEdit,
  onToggle,
}: {
  seq: Sequence;
  expanded: boolean;
  onExpand: () => void;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <article className="rounded-card border border-[var(--border)] bg-surface p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onExpand}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-semibold">{s.name}</h2>
            {s.isDemo && (
              <span className="rounded-pill bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-2 py-0.5 text-[10px] text-accent">
                Template
              </span>
            )}
            <span
              className={`h-2 w-2 rounded-full ${s.active ? "bg-emerald-500" : "bg-slate-300"}`}
              title={s.active ? "Active" : "Paused"}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {s.steps.map((step, i) => (
              <span
                key={step.id ?? i}
                className="inline-flex items-center gap-1 rounded-pill bg-surface-2 px-2 py-0.5 text-[10px] text-ink-2"
              >
                {CHANNEL_ICON[step.channel]}
                {i === 0 && step.delayMinutes === 0 ? "Instant" : `+${formatDelay(step.delayMinutes)}`}
              </span>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-muted">
            {s.stats.enrolled} enrolled · {s.stats.replies} replies ({s.stats.replyRate}
            %) ·{" "}
            <span style={{ color: "var(--good-text)" }}>{s.stats.booked} booked</span>
          </div>
        </button>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            className="rounded-control border border-[var(--border)] px-2 py-1 text-xs"
            onClick={onEdit}
          >
            Edit
          </button>
          <button
            type="button"
            className="rounded-control border border-[var(--border)] px-2 py-1 text-xs"
            onClick={onToggle}
          >
            {s.active ? "Pause" : "Activate"}
          </button>
        </div>
      </div>

      {expanded && (
        <ol className="relative mt-4 space-y-0 border-l border-[var(--border)] pl-4">
          {s.steps.map((step, i) => (
            <li key={step.id ?? i} className="relative pb-4 last:pb-0">
              <span className="absolute -left-[21px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-surface text-[10px]">
                {CHANNEL_ICON[step.channel]}
              </span>
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted">
                Wait {formatDelayLong(step.delayMinutes)} · {step.channel}
              </div>
              <div className="mt-0.5 text-sm font-medium">
                {step.subject ||
                  (step.channel === "SMS"
                    ? "SMS step"
                    : step.channel === "CALL"
                      ? "Call task"
                      : "Email step")}
              </div>
              <p className="mt-0.5 whitespace-pre-line text-xs text-ink-2">{step.body}</p>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

/* ---------------- Variables manager ---------------- */

const BUILTIN_AUTO: Array<{ tag: string; desc: string }> = [
  { tag: "first_name", desc: "Lead's first name" },
  { tag: "name", desc: "Lead's full name" },
  { tag: "property", desc: "The offering the lead asked about" },
  { tag: "dates", desc: "Lead's timeframe" },
  { tag: "quote_link", desc: "Best booking / quote link for this lead" },
  { tag: "unsub_link", desc: "Unsubscribe link (auto-added to emails)" },
  { tag: "season", desc: "Current season (spring, summer, fall, winter)" },
];

const BUILTIN_EDITABLE: Array<{ key: string; label: string; placeholder: string }> = [
  { key: "host_name", label: "Your name (signature)", placeholder: "e.g. Taylor" },
  { key: "business_name", label: "Business name", placeholder: "e.g. Coda Motors" },
  { key: "booking_link", label: "Default booking link", placeholder: "https://…" },
];

function VariablesModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Array<{ key: string; value: string }>>([]);
  const [builtins, setBuiltins] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const { data } = useQuery({
    queryKey: ["org-variables"],
    queryFn: async () => {
      const res = await fetch("/api/v1/org/variables");
      if (!res.ok) throw new Error("Failed to load variables");
      return res.json() as Promise<{ variables: Record<string, string> }>;
    },
  });

  useEffect(() => {
    if (!data || loaded) return;
    const vars = { ...data.variables };
    const b: Record<string, string> = {};
    for (const def of BUILTIN_EDITABLE) {
      if (vars[def.key]) {
        b[def.key] = vars[def.key]!;
        delete vars[def.key];
      }
    }
    setBuiltins(b);
    setRows(Object.entries(vars).map(([key, value]) => ({ key, value })));
    setLoaded(true);
  }, [data, loaded]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const variables: Record<string, string> = {};
      for (const def of BUILTIN_EDITABLE) {
        const v = (builtins[def.key] ?? "").trim();
        if (v) variables[def.key] = v;
      }
      for (const row of rows) {
        const key = row.key.trim().toLowerCase().replace(/\s+/g, "_");
        if (!key) continue;
        if (!/^[a-z][a-z0-9_]{0,39}$/.test(key)) {
          throw new Error(
            `"${row.key}" is not a valid variable name. Use letters, numbers and underscores, starting with a letter.`,
          );
        }
        if (!row.value.trim()) continue;
        variables[key] = row.value.trim();
      }
      const res = await fetch("/api/v1/org/variables", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variables }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Save failed");
      }
      await qc.invalidateQueries({ queryKey: ["org-variables"] });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-card border border-[var(--border)] bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h3 className="font-semibold">Message variables</h3>
          <button type="button" className="text-sm text-muted" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              Your business
            </div>
            <p className="mt-1 text-xs text-ink-2">
              Used anywhere you write the matching {"{{tag}}"} in a message.
            </p>
            <div className="mt-3 space-y-2">
              {BUILTIN_EDITABLE.map((def) => (
                <div key={def.key} className="flex items-center gap-2">
                  <code className="w-40 shrink-0 rounded-control bg-surface-2 px-2 py-1.5 text-[11px]">
                    {`{{${def.key}}}`}
                  </code>
                  <input
                    className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-1.5 text-sm"
                    placeholder={def.placeholder}
                    value={builtins[def.key] ?? ""}
                    onChange={(e) =>
                      setBuiltins((b) => ({ ...b, [def.key]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              Custom variables
            </div>
            <p className="mt-1 text-xs text-ink-2">
              Create your own, like discount_code or showroom_address, then use{" "}
              {"{{discount_code}}"} in any step.{" "}
              <span className="whitespace-nowrap">
                Unlimited custom variables <UpgradeChip />
              </span>
            </p>
            <div className="mt-3 space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="w-40 shrink-0 rounded-control border border-[var(--border)] bg-page px-2 py-1.5 font-mono text-[11px]"
                    placeholder="variable_name"
                    value={row.key}
                    onChange={(e) => {
                      const next = [...rows];
                      next[i] = { ...row, key: e.target.value };
                      setRows(next);
                    }}
                  />
                  <input
                    className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-1.5 text-sm"
                    placeholder="Value"
                    value={row.value}
                    onChange={(e) => {
                      const next = [...rows];
                      next[i] = { ...row, value: e.target.value };
                      setRows(next);
                    }}
                  />
                  <button
                    type="button"
                    className="shrink-0 text-xs text-critical"
                    onClick={() => setRows(rows.filter((_, j) => j !== i))}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-sm text-accent"
                onClick={() => setRows([...rows, { key: "", value: "" }])}
              >
                ＋ Add variable
              </button>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              Filled automatically per lead
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {BUILTIN_AUTO.map((b) => (
                <span
                  key={b.tag}
                  title={b.desc}
                  className="rounded-pill bg-surface-2 px-2 py-1 font-mono text-[10px] text-ink-2"
                >
                  {`{{${b.tag}}}`}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              A variable with no value renders as blank, so a missing tag never sends a
              broken message.
            </p>
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
              {saving ? "Saving…" : "Save variables"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Sequence editor ---------------- */

function SequenceEditor({
  mode,
  initial,
  triggerLabels,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  initial?: Sequence;
  triggerLabels: Record<string, string>;
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

  const { data: varsData } = useQuery({
    queryKey: ["org-variables"],
    queryFn: async () => {
      const res = await fetch("/api/v1/org/variables");
      if (!res.ok) return { variables: {} };
      return res.json() as Promise<{ variables: Record<string, string> }>;
    },
  });

  const chips = useMemo(() => {
    const custom = Object.keys(varsData?.variables ?? {});
    const builtin = ["first_name", "property", "host_name", "business_name", "dates", "quote_link", "unsub_link"];
    return [...builtin, ...custom.filter((c) => !builtin.includes(c))];
  }, [varsData]);

  const firstSmsWarn = useMemo(() => {
    const firstSms = steps.find((s) => s.channel === "SMS");
    return firstSms && !/stop/i.test(firstSms.body);
  }, [steps]);

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    const [a, b] = [next[i]!, next[j]!];
    next[i] = b;
    next[j] = a;
    setSteps(next);
  }

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
              {Object.entries(triggerLabels).map(([k, label]) => (
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
                    <div className="flex flex-col">
                      <button
                        type="button"
                        aria-label="Move step up"
                        disabled={i === 0}
                        className="text-[10px] leading-none text-muted disabled:opacity-30"
                        onClick={() => move(i, -1)}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        aria-label="Move step down"
                        disabled={i === steps.length - 1}
                        className="text-[10px] leading-none text-muted disabled:opacity-30"
                        onClick={() => move(i, 1)}
                      >
                        ▼
                      </button>
                    </div>
                    <span className="text-xs text-muted">Step {i + 1}</span>
                    <span className="text-xs text-muted">· wait</span>
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
                      placeholder="Subject (variables work here too)"
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
                        ? "Call script / talking points"
                        : "Message body. Click a variable chip below to insert it."
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
                    {chips.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="rounded-pill bg-surface-2 px-2 py-0.5 text-[10px] text-ink-2 hover:bg-surface"
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
