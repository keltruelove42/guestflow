"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/icons";

type Attention = {
  id: string;
  name: string;
  stage: string;
  travelDates: string | null;
  property: { name: string } | null;
};

type Lead = {
  id: string;
  name: string;
  stage: string;
  property?: { name: string } | null;
  enrollments: Array<{ sequence: { name: string }; currentStep: number }>;
};

/**
 * Mobile-first follow-ups view: what needs a human reply right now, plus a
 * one-tap way to fire everything that's due. (Sequence *editing* stays on
 * desktop, this screen is for completing follow-ups on the go.)
 */
export default function FollowupsPage() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const property = searchParams.get("property");
  const [toast, setToast] = useState<string | null>(null);

  const { data: attention = [], isLoading } = useQuery({
    queryKey: ["attention", property],
    queryFn: async () => {
      const qs = property ? `?propertyId=${property}` : "";
      const res = await fetch(`/api/v1/attention${qs}`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<Attention[]>;
    },
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads", property],
    queryFn: async () => {
      const qs = property ? `?property=${property}` : "";
      const res = await fetch(`/api/v1/leads${qs}`);
      if (!res.ok) return [];
      return res.json() as Promise<Lead[]>;
    },
  });

  const enrolled = leads.filter((l) => l.enrollments.length > 0);

  const tick = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/simulate/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advanceMinutes: 60 * 24 * 14 }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed");
      }
      return res.json() as Promise<{ sent: number; skipped: number }>;
    },
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ["leads"] });
      await qc.invalidateQueries({ queryKey: ["attention"] });
      setToast(`Sent ${r.sent ?? 0} due message(s)${r.skipped ? `, ${r.skipped} skipped` : ""}.`);
      setTimeout(() => setToast(null), 4000);
    },
    onError: (e) => {
      setToast(e instanceof Error ? e.message : "Failed");
      setTimeout(() => setToast(null), 4000);
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Needs your reply</h2>
          <span className="text-xs text-muted">automation paused → human</span>
        </div>
        <div className="overflow-hidden rounded-card border border-[var(--border)] bg-surface">
          {isLoading && <p className="p-4 text-sm text-muted">Loading…</p>}
          {!isLoading && attention.length === 0 && (
            <p className="p-4 text-sm text-muted">
              Nothing waiting on you — automated follow-ups are handling it.
            </p>
          )}
          {attention.map((a) => (
            <Link
              key={a.id}
              href={`/leads?open=${a.id}`}
              className="flex min-h-[56px] items-center gap-3 border-b border-[var(--border)] px-4 py-3 last:border-0 active:bg-surface-2/60"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2">
                <Icon name="message" size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{a.name}</div>
                <div className="truncate text-xs text-muted">
                  {a.property?.name ?? "No property"}
                  {a.travelDates ? ` · ${a.travelDates}` : ""}
                </div>
              </div>
              <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-[10px]">{a.stage}</span>
              <span className="text-muted">›</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Automated sequences</h2>
          <span className="text-xs text-muted">{enrolled.length} enrolled</span>
        </div>
        <div className="overflow-hidden rounded-card border border-[var(--border)] bg-surface">
          {enrolled.length === 0 && (
            <p className="p-4 text-sm text-muted">No leads in sequences right now.</p>
          )}
          {enrolled.slice(0, 8).map((l) => (
            <Link
              key={l.id}
              href={`/leads?open=${l.id}`}
              className="flex min-h-[52px] items-center gap-3 border-b border-[var(--border)] px-4 py-2.5 last:border-0 active:bg-surface-2/60"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{l.name}</div>
                <div className="truncate text-xs text-muted">
                  {l.enrollments[0]
                    ? `${l.enrollments[0].sequence.name} · step ${l.enrollments[0].currentStep + 1}`
                    : ""}
                </div>
              </div>
              <span className="text-muted">›</span>
            </Link>
          ))}
        </div>
        <button
          type="button"
          className="mt-3 w-full rounded-control bg-accent py-2.5 text-sm font-medium text-white disabled:opacity-60"
          disabled={tick.isPending}
          onClick={() => tick.mutate()}
        >
          {tick.isPending ? "Sending…" : "Send due sequences now"}
        </button>
        <p className="mt-2 text-center text-xs text-muted md:hidden">
          Build or edit sequences on desktop, this screen is for staying on top of them.
        </p>
      </section>

      {toast && (
        <div className="fixed bottom-20 left-4 right-4 z-50 rounded-card border border-[var(--border)] bg-surface px-4 py-3 text-sm shadow-lg md:bottom-4 md:left-auto md:max-w-sm">
          {toast}
        </div>
      )}
    </div>
  );
}
