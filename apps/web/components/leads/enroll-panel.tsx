"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Icon } from "@/components/ui/icons";
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

  const activeEnr = enrollments.find(
    (e) => e.status === "ACTIVE" || e.status === "PAUSED",
  );
  const currentSeqId = activeEnr?.sequence.id ?? "";

  // Preselect the active sequence so the dropdown reflects reality; changing it
  // and hitting Switch cancels the old enrollment and starts the new one.
  const [enrollSeqId, setEnrollSeqId] = useState(currentSeqId);
  useEffect(() => {
    setEnrollSeqId(currentSeqId);
  }, [currentSeqId]);

  const enroll = useMutation({
    mutationFn: () =>
      api(`/api/v1/leads/${leadId}/enroll`, {
        method: "POST",
        body: { sequenceId: enrollSeqId, replace: Boolean(activeEnr) },
        errorMessage: "Enroll failed",
      }),
    onSuccess: async () => {
      onError(null);
      await qc.invalidateQueries({ queryKey: ["lead", leadId] });
      await qc.invalidateQueries({ queryKey: ["leads"] });
      onEnrolled(
        activeEnr ? "Switched sequence, first step scheduled." : "Enrolled, first step scheduled.",
      );
    },
    onError: (e) => onError(e instanceof Error ? e.message : "Enroll failed"),
  });

  const activeSequences = sequences.filter(
    (s) => s.active || s.id === currentSeqId,
  );
  const isSwitch = Boolean(activeEnr);
  // Enroll (no current) → need a pick. Switch → need a DIFFERENT pick.
  const canSubmit =
    !!enrollSeqId && enrollSeqId !== currentSeqId && !enroll.isPending;

  return (
    <div className="space-y-1.5">
      {activeEnr && (
        <div className="flex items-center gap-1.5 text-xs text-ink-2">
          <Icon name="repeat" size={12} className="text-muted" />
          <span>
            Currently on <b className="text-ink">{activeEnr.sequence.name}</b> · step{" "}
            {activeEnr.currentStep + 1} · {activeEnr.status.toLowerCase()}
          </span>
        </div>
      )}
      <div className="flex gap-2">
        <select
          className="min-w-0 flex-1 rounded-control border border-[var(--border)] bg-page px-2.5 py-2 text-sm outline-none"
          value={enrollSeqId}
          onChange={(e) => setEnrollSeqId(e.target.value)}
        >
          <option value="">{isSwitch ? "Switch to…" : "Choose a sequence…"}</option>
          {activeSequences.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.id === currentSeqId ? " (current)" : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="shrink-0 rounded-control bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={!canSubmit}
          onClick={() => enroll.mutate()}
        >
          {enroll.isPending
            ? isSwitch
              ? "Switching…"
              : "Enrolling…"
            : isSwitch
              ? "Switch"
              : "Enroll"}
        </button>
      </div>
    </div>
  );
}
