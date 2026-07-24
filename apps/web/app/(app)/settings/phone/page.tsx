"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Toast, useToast } from "@/components/ui/toast";

type MissedCall = {
  enabled: boolean;
  forwardPhone: string | null;
  text: string | null;
  defaultText: string;
  webhookUrl: string | null;
};

type MissedCallPatch = {
  enabled?: boolean;
  forwardPhone?: string | null;
  text?: string | null;
};

export default function PhoneSettingsPage() {
  const qc = useQueryClient();
  const { toast, showToast } = useToast();

  const [forwardPhone, setForwardPhone] = useState("");
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["missed-call"],
    queryFn: () =>
      api<MissedCall>("/api/v1/org/missed-call", {
        errorMessage: "Failed to load missed-call settings",
      }),
  });

  useEffect(() => {
    if (data) {
      setForwardPhone(data.forwardPhone ?? "");
      setText(data.text ?? "");
    }
  }, [data]);

  const save = useMutation({
    mutationFn: (patch: MissedCallPatch) =>
      api<{ ok: true }>("/api/v1/org/missed-call", {
        method: "PUT",
        body: patch,
        errorMessage: "Could not update missed-call settings",
      }),
    onSuccess: (_res, patch) => {
      qc.setQueryData<MissedCall>(["missed-call"], (prev) => {
        if (!prev) return prev;
        const next = { ...prev };
        if ("enabled" in patch) next.enabled = Boolean(patch.enabled);
        if ("forwardPhone" in patch)
          next.forwardPhone = (patch.forwardPhone as string | null) ?? null;
        if ("text" in patch) next.text = (patch.text as string | null) ?? null;
        return next;
      });
      const label =
        "enabled" in patch
          ? patch.enabled
            ? "Missed-call text-back turned on."
            : "Missed-call text-back turned off."
          : "forwardPhone" in patch
            ? "Phone saved."
            : "Message saved.";
      showToast(label);
    },
    onError: (e) =>
      showToast(
        e instanceof ApiError ? e.message : "Could not update missed-call settings",
      ),
  });

  const enabled = data?.enabled ?? false;
  const webhookUrl = data?.webhookUrl ?? null;
  const defaultText = data?.defaultText ?? "";
  const busy = save.isPending;

  const phoneDirty = forwardPhone.trim() !== (data?.forwardPhone ?? "");
  const textDirty = text.trim() !== (data?.text ?? "");

  async function copyWebhook() {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Could not copy to clipboard");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="rounded-card border border-[var(--border)] bg-surface p-5">
        <h2 className="text-sm font-semibold">Missed-call text-back</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-2">
          Never lose a missed call. When a call to your business number goes
          unanswered, LeadCoda instantly texts the caller so the lead isn&apos;t lost —
          and your AI assistant takes over the conversation the moment they reply. Great
          for trades and beauty businesses where you can&apos;t always pick up.
        </p>

        {isLoading ? (
          <p className="mt-4 text-sm text-muted">Loading…</p>
        ) : (
          <div className="mt-4 space-y-5">
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={enabled}
                disabled={busy}
                onChange={(e) => save.mutate({ enabled: e.target.checked })}
              />
              <span>
                <span className="block text-sm font-medium">
                  Turn on missed-call text-back
                </span>
                <span className="block text-xs text-muted">
                  Automatically text callers you miss and let the AI assistant follow up.
                </span>
              </span>
            </label>

            <Field
              label="Ring this phone first (optional)"
              hint="We ring this number first; if no one answers, we text the caller. Leave blank to text back immediately."
            >
              <div className="flex gap-2">
                <Input
                  className="min-w-0 flex-1"
                  type="tel"
                  placeholder="+1 555 123 4567"
                  value={forwardPhone}
                  disabled={busy}
                  onChange={(e) => setForwardPhone(e.target.value)}
                />
                <Button
                  variant="secondary"
                  className="shrink-0 disabled:opacity-50"
                  disabled={busy || !phoneDirty}
                  onClick={() =>
                    save.mutate({ forwardPhone: forwardPhone.trim() || null })
                  }
                >
                  {busy ? "Saving…" : "Save"}
                </Button>
              </div>
            </Field>

            <Field
              label="Text-back message"
              hint="Merge tags {{first_name}} and {{business_name}} work. Leave blank to use the default."
            >
              <Textarea
                rows={3}
                placeholder={defaultText}
                value={text}
                disabled={busy}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="mt-2 flex justify-end">
                <Button
                  variant="secondary"
                  className="disabled:opacity-50"
                  disabled={busy || !textDirty}
                  onClick={() => save.mutate({ text: text.trim() || null })}
                >
                  {busy ? "Saving…" : "Save message"}
                </Button>
              </div>
            </Field>
          </div>
        )}
      </div>

      <div className="rounded-card border border-[var(--border)] bg-surface p-5">
        <h2 className="text-sm font-semibold">Connect your Twilio number</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-2">
          Point your Twilio phone number&apos;s Voice webhook at LeadCoda so we can catch
          unanswered calls.
        </p>

        {webhookUrl ? (
          <>
            <div className="mt-4 flex items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-control bg-surface-2 px-3 py-2 text-xs text-ink">
                {webhookUrl}
              </code>
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0"
                onClick={() => void copyWebhook()}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-ink-2">
              <li>
                In your Twilio Console, go to Phone Numbers → your number → Voice
                Configuration.
              </li>
              <li>
                Under &ldquo;A call comes in&rdquo;, set it to Webhook, HTTP POST, and
                paste this URL.
              </li>
              <li>Save. That&apos;s it — missed calls now text back automatically.</li>
            </ol>
            <p className="mt-3 text-xs text-muted">
              If you use LeadCoda managed texting, tell us and we&apos;ll set this
              automatically.
            </p>
          </>
        ) : (
          <p className="mt-4 rounded-control bg-surface-2 px-3 py-2 text-xs text-ink-2">
            Your webhook URL isn&apos;t available yet. An <code>APP_URL</code> must be
            configured for your workspace before this can be set up.
          </p>
        )}
      </div>

      <Toast message={toast} />
    </div>
  );
}
