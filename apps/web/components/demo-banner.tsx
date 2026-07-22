"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useVertical } from "@/components/vertical-provider";
import { useState } from "react";

export function DemoDataBanner() {
  const qc = useQueryClient();
  const pack = useVertical();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { data: counts } = useQuery({
    queryKey: ["demo-counts"],
    queryFn: async () => {
      const res = await fetch("/api/v1/org/clear-demo");
      if (!res.ok) {
        return { total: 0, leads: 0, properties: 0, campaigns: 0, sequences: 0 };
      }
      return res.json() as Promise<{
        total: number;
        leads: number;
        properties: number;
        campaigns: number;
        sequences: number;
      }>;
    },
    refetchInterval: 15_000,
  });

  const restore = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/org/restore-demo", { method: "POST" });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? `Failed to restore (HTTP ${res.status})`);
      }
      return res.json() as Promise<{ message: string }>;
    },
    onSuccess: async (data) => {
      setMessage(data.message);
      await qc.invalidateQueries(); // refresh every screen — the whole dataset changed
      setTimeout(() => setMessage(null), 5000);
    },
    onError: (e) => {
      setMessage(
        `Restore failed: ${e instanceof Error ? e.message : "unknown error"} — try again or contact support.`,
      );
      setTimeout(() => setMessage(null), 8000);
    },
  });


  const clear = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/org/clear-demo", { method: "POST" });
      if (!res.ok) throw new Error("Failed to clear");
      return res.json() as Promise<{ message: string; deleted: Record<string, number> }>;
    },
    onSuccess: async (data) => {
      setConfirming(false);
      setMessage(data.message);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["demo-counts"] }),
        qc.invalidateQueries({ queryKey: ["leads"] }),
        qc.invalidateQueries({ queryKey: ["leads-count"] }),
        qc.invalidateQueries({ queryKey: ["properties"] }),
        qc.invalidateQueries({ queryKey: ["campaigns"] }),
        qc.invalidateQueries({ queryKey: ["sequences"] }),
        qc.invalidateQueries({ queryKey: ["integrations"] }),
      ]);
      setTimeout(() => setMessage(null), 5000);
    },
  });

  if (!counts || counts.total === 0) {
    if (message) {
      return (
        <div className="border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--good)_12%,transparent)] px-6 py-2 text-sm text-ink-2">
          {message}
        </div>
      );
    }
    if (counts && counts.total === 0) {
      return (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-surface px-4 py-1.5 text-xs text-muted md:px-6">
          <span>Demo data cleared — your own leads and sequences are untouched.</span>
          <button
            type="button"
            className="rounded-control border border-[var(--border)] px-2.5 py-1 text-xs text-ink-2 disabled:opacity-60"
            disabled={restore.isPending}
            onClick={() => restore.mutate()}
          >
            {restore.isPending ? "Restoring…" : "Restore demo data"}
          </button>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] px-6 py-2.5 text-sm">
      <div className="text-ink-2">
        <b className="text-ink">Demo data</b>
        <span className="hidden md:inline">
          {" — "}
          {counts.leads} leads · {counts.properties} {pack.context.plural.toLowerCase()} · {counts.campaigns} campaigns.
          Templates and anything you add yourself are kept when you clear.
        </span>
        <span className="md:hidden"> · {counts.total} rows</span>
      </div>
      {!confirming ? (
        <button
          type="button"
          className="shrink-0 rounded-control border border-[var(--border)] bg-surface px-3 py-1.5 text-xs font-medium"
          onClick={() => setConfirming(true)}
        >
          Clear demo data
        </button>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-ink-2">Delete all demo rows?</span>
          <button
            type="button"
            className="rounded-control bg-critical px-3 py-1.5 text-xs font-medium text-white"
            disabled={clear.isPending}
            onClick={() => clear.mutate()}
          >
            {clear.isPending ? "Clearing…" : "Yes, clear"}
          </button>
          <button
            type="button"
            className="rounded-control border border-[var(--border)] px-3 py-1.5 text-xs"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
