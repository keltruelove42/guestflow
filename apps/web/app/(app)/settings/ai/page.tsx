"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Toast, useToast } from "@/components/ui/toast";
import { UpgradeChip } from "@/components/upgrade";
import { cn } from "@/lib/utils";

type Mode = "OFF" | "SUGGEST" | "AUTOPILOT";

type AiAgent = {
  mode: Mode;
  available: boolean;
  configured: boolean;
};

const OPTIONS: Array<{
  mode: Mode;
  title: string;
  recommend?: boolean;
  description: string;
}> = [
  {
    mode: "OFF",
    title: "Off",
    description: "The assistant stays idle.",
  },
  {
    mode: "SUGGEST",
    title: "Suggest",
    recommend: true,
    description:
      "Drafts a reply for every inbound lead message. You review and send.",
  },
  {
    mode: "AUTOPILOT",
    title: "Autopilot",
    description:
      "Sends replies automatically. Fully gated by consent, quiet hours, and your trial limits; anything it can't send (or isn't sure about) becomes a suggestion instead.",
  },
];

type EnrichmentSettings = {
  auto: boolean;
  webhookUrl: string | null;
  available: boolean;
};

function EnrichmentCard({ showToast }: { showToast: (m: string) => void }) {
  const qc = useQueryClient();
  const [webhook, setWebhook] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["org-enrichment"],
    queryFn: () =>
      api<EnrichmentSettings>("/api/v1/org/enrichment", {
        errorMessage: "Failed to load enrichment settings",
      }),
  });

  useEffect(() => {
    if (data) setWebhook(data.webhookUrl ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: (patch: { auto?: boolean; webhookUrl?: string | null }) =>
      api<{ auto: boolean; webhookUrl: string | null }>("/api/v1/org/enrichment", {
        method: "PUT",
        body: patch,
        errorMessage: "Could not update enrichment settings",
      }),
    onSuccess: (res, patch) => {
      qc.setQueryData<EnrichmentSettings>(["org-enrichment"], (prev) =>
        prev ? { ...prev, auto: res.auto, webhookUrl: res.webhookUrl } : prev,
      );
      showToast(
        "webhookUrl" in patch ? "Webhook saved." : "Enrichment settings saved.",
      );
    },
    onError: (e) =>
      showToast(
        e instanceof ApiError ? e.message : "Could not update enrichment settings",
      ),
  });

  const available = data?.available ?? false;
  const auto = data?.auto ?? false;
  const disabled = !available || save.isPending;
  const webhookDirty = webhook.trim() !== (data?.webhookUrl ?? "");

  return (
    <div className="rounded-card border border-[var(--border)] bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Enrichment</h2>
        {!available && <UpgradeChip />}
      </div>
      <p className="mt-1 text-xs text-muted">
        Look up company, role, industry, and talking points for new leads from their
        email and public data.
      </p>
      {!available && (
        <p className="mt-2 text-xs text-ink-2">Included with the Growth plan.</p>
      )}

      {isLoading ? (
        <p className="mt-4 text-sm text-muted">Loading…</p>
      ) : (
        <div className="mt-4 space-y-5">
          <label
            className={cn(
              "flex items-start gap-2.5",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={auto}
              disabled={disabled}
              onChange={(e) => save.mutate({ auto: e.target.checked })}
            />
            <span>
              <span className="block text-sm font-medium">Auto-enrich new leads</span>
              <span className="block text-xs text-muted">
                Run enrichment automatically as leads come in.
              </span>
            </span>
          </label>

          <Field
            label="External provider webhook (optional)"
            hint="LeadCoda posts each lead (name / email / phone plus a callbackUrl) to this URL. Your provider (Clay, etc.) runs its data waterfall and POSTs verified fields back to the callbackUrl."
          >
            <div className="flex gap-2">
              <Input
                className="min-w-0 flex-1"
                type="url"
                placeholder="https://… (e.g. a Clay table webhook URL)"
                value={webhook}
                disabled={disabled}
                onChange={(e) => setWebhook(e.target.value)}
              />
              <Button
                variant="secondary"
                className="shrink-0 disabled:opacity-50"
                disabled={disabled || !webhookDirty}
                onClick={() => save.mutate({ webhookUrl: webhook.trim() || null })}
              >
                {save.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </Field>
        </div>
      )}
    </div>
  );
}

export default function AiAssistantPage() {
  const qc = useQueryClient();
  const { toast, showToast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["org-ai-agent"],
    queryFn: () =>
      api<AiAgent>("/api/v1/org/ai-agent", {
        errorMessage: "Failed to load AI assistant settings",
      }),
  });

  const setMode = useMutation({
    mutationFn: (mode: Mode) =>
      api<{ mode: Mode }>("/api/v1/org/ai-agent", {
        method: "PUT",
        body: { mode },
        errorMessage: "Could not update the AI assistant",
      }),
    onMutate: (mode) => {
      // Optimistic: reflect the selection immediately.
      const prev = qc.getQueryData<AiAgent>(["org-ai-agent"]);
      if (prev) qc.setQueryData<AiAgent>(["org-ai-agent"], { ...prev, mode });
      return { prev };
    },
    onSuccess: (res) => {
      const label =
        res.mode === "OFF"
          ? "AI assistant turned off"
          : res.mode === "SUGGEST"
            ? "AI assistant will suggest replies"
            : "AI assistant is on autopilot";
      showToast(label);
      void qc.invalidateQueries({ queryKey: ["org-ai-agent"] });
    },
    onError: (e, _mode, ctx) => {
      if (ctx?.prev) qc.setQueryData(["org-ai-agent"], ctx.prev);
      showToast(e instanceof ApiError ? e.message : "Could not update the AI assistant");
    },
  });

  const available = data?.available ?? false;
  const configured = data?.configured ?? true;
  const mode = data?.mode ?? "OFF";

  function select(next: Mode) {
    if (next === mode || setMode.isPending) return;
    // Client-side gate: only OFF is allowed without Growth. Server 403s anyway.
    if (!available && next !== "OFF") return;
    setMode.mutate(next);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="rounded-card border border-[var(--border)] bg-surface p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">AI Assistant</h2>
          {!available && <UpgradeChip />}
        </div>
        <p className="mt-1 text-xs text-muted">
          The assistant reads incoming lead replies and drafts (or sends) an on-brand
          answer using your business info. It can check availability and book
          appointments for you.
        </p>

        {!available && (
          <p className="mt-2 text-xs text-ink-2">Included with the Growth plan.</p>
        )}
        {available && !configured && (
          <p className="mt-2 text-xs text-muted">
            Your workspace admin needs to add an AI key to activate this. You can still
            pick a mode now — it takes effect once configured.
          </p>
        )}

        {isLoading ? (
          <p className="mt-4 text-sm text-muted">Loading…</p>
        ) : (
          <div className="mt-4 space-y-2.5" role="radiogroup" aria-label="AI assistant mode">
            {OPTIONS.map((opt) => {
              const selected = mode === opt.mode;
              const disabled = !available && opt.mode !== "OFF";
              return (
                <button
                  key={opt.mode}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled || setMode.isPending}
                  onClick={() => select(opt.mode)}
                  className={cn(
                    "block w-full rounded-card border p-4 text-left transition-colors",
                    selected
                      ? "border-accent bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]"
                      : "border-[var(--border)] bg-surface hover:border-ink-2",
                    disabled && "cursor-not-allowed opacity-60 hover:border-[var(--border)]",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        selected ? "border-accent" : "border-[var(--border)]",
                      )}
                    >
                      {selected && <span className="h-2 w-2 rounded-full bg-accent" />}
                    </span>
                    <span className="text-sm font-semibold">{opt.title}</span>
                    {opt.recommend && (
                      <span className="rounded-pill bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-2 py-0.5 text-[10px] font-medium text-accent">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 pl-6 text-xs leading-relaxed text-ink-2">
                    {opt.description}
                  </p>
                  {opt.mode === "AUTOPILOT" && (
                    <p className="mt-1.5 pl-6 text-xs leading-relaxed text-warn">
                      ⚠ Autopilot replies to leads on its own. Review your brand voice and
                      quiet hours before turning it on.
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <EnrichmentCard showToast={showToast} />

      <Toast message={toast} />
    </div>
  );
}
