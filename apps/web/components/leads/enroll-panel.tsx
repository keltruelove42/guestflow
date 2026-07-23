"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSequences } from "@/lib/queries";
import type { LeadEnrollment } from "./types";

/**
 * Enroll-in-sequence block: shows the active/paused enrollment if there is one,
 * otherwise a sequence picker + enroll button. Shared by the lead drawer
 * ("Follow-up sequence") and the lead record page ("Automation").
 */
export function EnrollPanel({
  leadId,
  enrollments,
  onError,
  onEnrolled,
}: {
  leadId: string;
  enrollments: LeadEnrollment[];
  onError: (message: string | null) => void;
  /** Called with the toast message after a successful enroll. */
  onEnrolled: (message: string) => void;
}) {
  const qc = useQueryClient();
  const { data: sequences = [] } = useSequences();
  const [enrollSeqId, setEnrollSeqId] = useState("");

  const enroll = useMutation({
    mutationFn: () =>
      api(`/api/v1/leads/${leadId}/enroll`, {
        method: "POST",
        body: { sequenceId: enrollSeqId },
        errorMessage: "Enroll failed",
      }),
    onSuccess: async () => {
      onError(null);
      await qc.invalidateQueries({ queryKey: ["lead", leadId] });
      await qc.invalidateQueries({ queryKey: ["leads"] });
      onEnrolled("Enrolled, first step scheduled.");
    },
    onError: (e) => onError(e instanceof Error ? e.message : "Enroll failed"),
  });

  const activeEnr = enrollments.find(
    (e) => e.status === "ACTIVE" || e.status === "PAUSED",
  );

  return activeEnr ? (
    <div className="rounded-control border border-[var(--border)] bg-surface-2 px-3 py-2 text-xs text-ink-2">
      🔁 {activeEnr.sequence.name} · step {activeEnr.currentStep + 1} ·{" "}
      {activeEnr.status.toLowerCase()}
    </div>
  ) : (
    <div className="flex gap-2">
      <select
        className="min-w-0 flex-1 rounded-control border border-[var(--border)] bg-page px-2.5 py-2 text-sm outline-none"
        value={enrollSeqId}
        onChange={(e) => setEnrollSeqId(e.target.value)}
      >
        <option value="">Choose a sequence…</option>
        {sequences
          .filter((s) => s.active)
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
      </select>
      <button
        type="button"
        className="shrink-0 rounded-control bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        disabled={!enrollSeqId || enroll.isPending}
        onClick={() => enroll.mutate()}
      >
        {enroll.isPending ? "Enrolling…" : "Enroll"}
      </button>
    </div>
  );
}
