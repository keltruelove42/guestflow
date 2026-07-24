"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Input, Textarea } from "@/components/ui/field";
import { api } from "@/lib/api";
import type { DeliveryStatus } from "@/lib/queries";

/**
 * Channel picker + message editor + merge-tag hint + send button, shared by the
 * lead drawer and the lead record page.
 *
 * The error slot is owned by the caller because both call sites surface enroll
 * errors in the same spot (between the merge-tag hint and the send button).
 */
/**
 * Client-side merge-tag preview so the sender SEES the personalized message
 * before sending. This mirrors the server's substitution for the common tags;
 * the actual send re-renders authoritatively (incl. org custom variables).
 */
function previewMergeTags(
  text: string,
  ctx: { first_name: string; name: string; property: string; host_name: string; dates: string },
): string {
  return text
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) =>
      key in ctx ? ((ctx as Record<string, string>)[key] ?? "") : "",
    )
    .replace(/ {2,}/g, " ");
}

export function ComposePanel({
  leadId,
  leadName,
  propertyName,
  hostName,
  canEmail,
  canSms,
  delivery,
  error,
  onError,
  onSent,
  onSendSuccess,
}: {
  leadId: string;
  leadName?: string | null;
  propertyName?: string | null;
  hostName?: string | null;
  canEmail: boolean;
  canSms: boolean;
  delivery?: DeliveryStatus;
  /** Shared error message (send + enroll errors), rendered above the button. */
  error: string | null;
  onError: (message: string | null) => void;
  /** Called with the toast message after a successful send. */
  onSent: (message: string) => void;
  /** Extra call-site work after a successful send (e.g. onboarding tracking). */
  onSendSuccess?: () => void | Promise<void>;
}) {
  const qc = useQueryClient();
  const [channel, setChannel] = useState<"EMAIL" | "SMS">("EMAIL");
  const [subject, setSubject] = useState("Following up on your stay");
  const [body, setBody] = useState(
    "Hi {{first_name}},\n\nJust checking in about {{property}}. Happy to answer any questions or hold dates for you.\n\n- {{host_name}}",
  );

  const send = useMutation({
    mutationFn: () =>
      api<{ delivery: string; channel: string }>(`/api/v1/leads/${leadId}/messages`, {
        method: "POST",
        body: {
          channel,
          subject: channel === "EMAIL" ? subject : undefined,
          body,
        },
        errorMessage: "Send failed",
      }),
    onSuccess: async (r) => {
      onError(null);
      await qc.invalidateQueries({ queryKey: ["lead", leadId] });
      await onSendSuccess?.();
      const mode =
        r.delivery === "live"
          ? "Delivered"
          : "Logged (demo, not delivered externally)";
      onSent(`${r.channel} sent. ${mode}.`);
    },
    onError: (e) => onError(e instanceof Error ? e.message : "Send failed"),
  });

  return (
    <>
      <div className="mb-2 flex gap-2">
        <button
          type="button"
          className={`rounded-pill px-3 py-1 text-xs ${
            channel === "EMAIL" ? "bg-accent text-white" : "bg-surface-2"
          }`}
          onClick={() => setChannel("EMAIL")}
        >
          Email
          {delivery?.email === "live" ? "" : " (log)"}
        </button>
        <button
          type="button"
          className={`rounded-pill px-3 py-1 text-xs ${
            channel === "SMS" ? "bg-accent text-white" : "bg-surface-2"
          }`}
          onClick={() => setChannel("SMS")}
        >
          SMS
          {delivery?.sms === "live" ? "" : " (log)"}
        </button>
      </div>
      {channel === "EMAIL" && (
        <Input
          className="mb-2"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
        />
      )}
      <Textarea
        className="min-h-[120px]"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <p className="mt-1 text-[11px] text-muted">
        Merge tags: {"{{first_name}}"}, {"{{property}}"}, {"{{host_name}}"},{" "}
        {"{{dates}}"}
      </p>

      {(() => {
        const fullName = leadName?.trim() || "there";
        const ctx = {
          first_name: fullName.split(/\s+/)[0] || "there",
          name: fullName,
          property: propertyName?.trim() || "your project",
          host_name: hostName?.trim() || "your team",
          dates: "your dates",
        };
        if (!body.trim()) return null;
        return (
          <div className="mt-2 rounded-control border border-[var(--border)] bg-surface-2/50 p-2.5">
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted">
              Preview · what {ctx.first_name} will see
            </div>
            {channel === "EMAIL" && subject.trim() && (
              <div className="mb-1 text-xs font-semibold text-ink">
                {previewMergeTags(subject, ctx)}
              </div>
            )}
            <div className="whitespace-pre-wrap text-xs text-ink-2">
              {previewMergeTags(body, ctx)}
            </div>
          </div>
        );
      })()}

      {error && <p className="mt-2 text-sm text-critical">{error}</p>}
      <button
        type="button"
        className="mt-3 w-full rounded-control bg-accent py-2 text-sm font-medium text-white disabled:opacity-50"
        disabled={
          send.isPending ||
          (channel === "EMAIL" ? !canEmail : !canSms) ||
          !body.trim()
        }
        onClick={() => send.mutate()}
      >
        {send.isPending
          ? "Sending…"
          : channel === "EMAIL"
            ? "Send email"
            : "Send SMS"}
      </button>
    </>
  );
}
