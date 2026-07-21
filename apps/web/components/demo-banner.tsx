"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export function DemoDataBanner() {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { data: counts } = useQuery({
    queryKey: ["demo-counts"],
    queryFn: async () => {
      const res = await fetch("/api/v1/org/clear-demo");
      if (!res.ok) return { total: 0 };
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
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] px-6 py-2.5 text-sm">
      <div className="text-ink-2">
        <b className="text-ink">Demo data</b>
        {" — "}
        {counts.leads} leads · {counts.properties} properties · {counts.campaigns} campaigns ·{" "}
        {counts.sequences} sequences. Anything you add yourself is kept when you clear.
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
