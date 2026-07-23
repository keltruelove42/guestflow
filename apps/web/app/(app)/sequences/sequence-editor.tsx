"use client";

import { useMemo, useState } from "react";
import { SequenceTrigger } from "@guestflow/shared";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { api } from "@/lib/api";
import { useOrgVariables, type Sequence, type SequenceStep } from "@/lib/queries";
import { delayToMinutes, parseDelay, type DelayUnit } from "./delay";

const EMPTY_STEP: SequenceStep = {
  delayMinutes: 0,
  channel: "EMAIL",
  subject: "",
  body: "",
};

/** Editor-local step: carries single-level AI-rewrite undo + inline error state. */
type EditorStep = SequenceStep & {
  prevRewrite?: { subject: string | null; body: string };
  aiError?: string;
};

export function SequenceEditor({
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
  const [heroPhotoUrl, setHeroPhotoUrl] = useState<string | null>(initial?.heroPhotoUrl ?? null);
  const [heroUploading, setHeroUploading] = useState(false);
  const [steps, setSteps] = useState<EditorStep[]>(
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
  const [rewritingIndex, setRewritingIndex] = useState<number | null>(null);

  const { data: varsData } = useOrgVariables();

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

  async function uploadHero(file: File) {
    setError(null);
    setHeroUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      // api() is JSON-only, so hit the upload endpoint with raw fetch + FormData.
      const res = await fetch("/api/v1/uploads?kind=hero", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? `Upload failed (${res.status})`);
      }
      setHeroPhotoUrl(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setHeroUploading(false);
    }
  }

  async function rewriteStep(i: number) {
    const step = steps[i];
    if (!step || !step.body.trim()) return;
    setRewritingIndex(i);
    setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, aiError: undefined } : s)));
    try {
      const result = await api<{ subject: string | null; body: string }>("/api/v1/ai/rewrite", {
        method: "POST",
        body: {
          channel: step.channel,
          subject: step.subject,
          body: step.body,
          sequenceId: mode === "edit" ? initial!.id : null,
        },
        errorMessage: "Rewrite failed",
      });
      setSteps((prev) =>
        prev.map((s, j) =>
          j === i
            ? {
                ...s,
                prevRewrite: { subject: s.subject, body: s.body },
                subject: s.channel === "SMS" ? s.subject : result.subject,
                body: result.body,
              }
            : s,
        ),
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Rewrite failed";
      setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, aiError: message } : s)));
    } finally {
      setRewritingIndex(null);
    }
  }

  function undoRewrite(i: number) {
    setSteps((prev) =>
      prev.map((s, j) =>
        j === i && s.prevRewrite
          ? { ...s, subject: s.prevRewrite.subject, body: s.prevRewrite.body, prevRewrite: undefined }
          : s,
      ),
    );
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
        heroPhotoUrl,
        steps: steps.map((s) => ({
          delayMinutes: s.delayMinutes,
          channel: s.channel,
          subject: s.channel === "SMS" ? null : s.subject,
          body: s.body,
        })),
      };

      if (mode === "create") {
        await api("/api/v1/sequences", {
          method: "POST",
          body: payload,
          errorMessage: "Save failed",
        });
      } else {
        await api(`/api/v1/sequences/${initial!.id}`, {
          method: "PATCH",
          body: payload,
          errorMessage: "Save failed",
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={mode === "create" ? "New sequence" : "Edit sequence"}
      size="lg"
      onClose={onClose}
    >
      <div className="space-y-4 p-5">
        {mode === "edit" && (
          <p className="rounded-control bg-surface-2 px-3 py-2 text-xs text-ink-2">
            Editing recomputes future scheduled sends for steps that no longer exist.
          </p>
        )}

        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field label="Trigger">
          <Select value={trigger} onChange={(e) => setTrigger(e.target.value)}>
            {Object.entries(triggerLabels).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Hero photo"
          hint="Optional — shown under your branded email header. Manage brand colors & logo in Settings → Brand."
        >
          {heroPhotoUrl ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroPhotoUrl}
                alt="Hero photo"
                className="h-16 w-24 rounded-control border border-[var(--border)] object-cover"
              />
              <button
                type="button"
                className="text-xs text-critical"
                onClick={() => setHeroPhotoUrl(null)}
              >
                Remove
              </button>
            </div>
          ) : (
            <input
              type="file"
              accept="image/*"
              disabled={heroUploading}
              className="block w-full text-sm text-ink-2 disabled:opacity-60"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void uploadHero(file);
              }}
            />
          )}
          {heroUploading && <p className="mt-1 text-xs text-muted">Uploading…</p>}
        </Field>

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
                      const unit = e.target.value as DelayUnit;
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
                <div className="flex items-center gap-2">
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs disabled:opacity-50"
                    disabled={!step.body.trim() || rewritingIndex === i}
                    onClick={() => rewriteStep(i)}
                  >
                    {rewritingIndex === i ? "Rewriting…" : "✨ Rewrite with AI"}
                  </Button>
                  {step.prevRewrite && rewritingIndex !== i && (
                    <button
                      type="button"
                      className="text-xs text-accent underline"
                      onClick={() => undoRewrite(i)}
                    >
                      Undo
                    </button>
                  )}
                </div>
                {step.aiError && <p className="text-xs text-critical">{step.aiError}</p>}
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
          <Button
            variant="link"
            onClick={() =>
              setSteps([
                ...steps,
                { delayMinutes: 1440, channel: "EMAIL", subject: "", body: "" },
              ])
            }
          >
            ＋ Add step
          </Button>
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
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save sequence"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
