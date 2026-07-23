"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { ImportLeadsModal } from "@/components/import-leads-modal";
import { useVertical } from "@/components/vertical-provider";
import { HeatDot, LeadsBoard, LeadsToday, type BoardLead } from "@/components/leads-views";
import { LeadDrawer } from "@/components/leads/lead-drawer";
import type { Lead } from "@/components/leads/types";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useMessagingStatus, useSequences } from "@/lib/queries";

export default function LeadsPage() {
  const searchParams = useSearchParams();
  const property = searchParams.get("property");
  const openId = searchParams.get("open");
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { toast, showToast } = useToast();
  const [importing, setImporting] = useState(false);
  const [view, setView] = useState<"board" | "table" | "today">("board");
  const [smartView, setSmartView] = useState<string>("all");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const pack = useVertical();

  useEffect(() => {
    if (openId) setSelectedId(openId);
  }, [openId]);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", property],
    queryFn: () => {
      const qs = property ? `property=${property}` : "";
      return api<Lead[]>(`/api/v1/leads${qs ? `?${qs}` : ""}`, {
        errorMessage: "Failed",
      });
    },
  });

  const { data: delivery } = useMessagingStatus();
  const { data: allSequences = [] } = useSequences();

  const patchLead = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api(`/api/v1/leads/${id}`, {
        method: "PATCH",
        body,
        errorMessage: "Update failed",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
    onError: (e) => showToast(e instanceof Error ? e.message : "Update failed"),
  });

  const bulk = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<{ count: number; enrolled: number }>("/api/v1/leads/bulk", {
        method: "POST",
        body: { ...body, ids: Array.from(checked) },
        errorMessage: "Bulk action failed",
      }),
    onSuccess: (d) => {
      setChecked(new Set());
      qc.invalidateQueries({ queryKey: ["leads"] });
      showToast(`Updated ${d.count} lead(s)${d.enrolled ? `, enrolled ${d.enrolled}` : ""}.`);
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "Bulk action failed"),
  });

  const tick = useMutation({
    mutationFn: () =>
      api<{ sent: number; skipped: number }>("/api/v1/simulate/tick", {
        method: "POST",
        body: { advanceMinutes: 60 * 24 * 14 },
        errorMessage: "Tick failed",
      }),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ["leads"] });
      if (selectedId) await qc.invalidateQueries({ queryKey: ["lead", selectedId] });
      showToast(`Sent ${r.sent ?? 0} due message(s)${r.skipped ? ` (${r.skipped} skipped)` : ""}.`);
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "Tick failed"),
  });

  return (
    <div className="space-y-4">
      <div className="hidden flex-wrap items-start justify-between gap-3 md:flex">
        <p className="max-w-xl text-sm text-ink-2">
          {pack.copy.leadsPageHint}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setImporting(true)}>
            ⬆️ Import past inquiries
          </Button>
          <Button variant="ghost" disabled={tick.isPending} onClick={() => tick.mutate()}>
            {tick.isPending ? "Sending…" : "Send due sequences now"}
          </Button>
        </div>
      </div>

      {/* Mobile: compact import button */}
      <div className="flex justify-end md:hidden">
        <Button variant="ghost" onClick={() => setImporting(true)}>
          ⬆️ Import
        </Button>
      </div>

      {delivery && (
        <div className="hidden rounded-control border border-[var(--border)] bg-surface-2 px-3 py-2 text-xs text-ink-2 md:block">
          Outbound: email{" "}
          <b className="text-ink">{delivery.email === "live" ? "live (Resend)" : "demo log"}</b>
          {" · "}
          SMS{" "}
          <b className="text-ink">{delivery.sms === "live" ? "live (Twilio)" : "demo log"}</b>
          {delivery.email === "log" && delivery.sms === "log" && (
            <span className="text-muted">
              {" "}
              - set{" "}
              <code className="rounded bg-surface px-1">SEND_MODE=live</code> plus{" "}
              <code className="rounded bg-surface px-1">RESEND_API_KEY</code> / Twilio env vars to
              deliver for real.
            </span>
          )}
        </div>
      )}

      {/* View tabs + smart filters */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 rounded-pill border border-[var(--border)] bg-surface p-1">
          {(
            [
              ["board", "▦ Pipeline"],
              ["table", "☰ Table"],
              ["today", "⚡ Work Today"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`rounded-pill px-3 py-1.5 text-xs font-medium ${
                view === key ? "bg-accent text-white" : "text-ink-2"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "All"],
              ["hot", "🔥 Hot"],
              ["attention", "💬 Needs reply"],
              ["new7", "🆕 New this week"],
              ["nonext", "⚠ No next step"],
              ["cold", "🧊 Going cold"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSmartView(key)}
              className={`rounded-pill px-2.5 py-1 text-[11px] ${
                smartView === key
                  ? "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] font-medium text-accent"
                  : "bg-surface-2 text-ink-2"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === "board" && (
        <LeadsBoard
          leads={applySmartView(leads, smartView)}
          pack={pack}
          onStageChange={(id, stage) => patchLead.mutate({ id, body: { stage } })}
        />
      )}

      {view === "today" && (
        <LeadsToday
          leads={applySmartView(leads, smartView)}
          onSnooze={(id, days) =>
            patchLead.mutate({
              id,
              body: { followUpAt: new Date(Date.now() + days * 864e5).toISOString() },
            })
          }
        />
      )}

      {/* Bulk action bar */}
      {view === "table" && checked.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-accent bg-surface px-3 py-2 text-xs">
          <span className="font-medium">{checked.size} selected</span>
          <select
            className="rounded-control border border-[var(--border)] bg-page px-2 py-1"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) bulk.mutate({ stage: e.target.value });
              e.target.value = "";
            }}
          >
            <option value="">Set stage…</option>
            {Object.entries(pack.stageLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            className="rounded-control border border-[var(--border)] bg-page px-2 py-1"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) bulk.mutate({ enrollSequenceId: e.target.value });
              e.target.value = "";
            }}
          >
            <option value="">Enroll in sequence…</option>
            {allSequences
              .filter((s) => s.active)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              const tag = window.prompt("Tag to add to selected leads:");
              if (tag?.trim()) bulk.mutate({ addTags: [tag.trim()] });
            }}
          >
            + Tag
          </Button>
          <button
            type="button"
            className="ml-auto text-muted"
            onClick={() => setChecked(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      {/* Mobile: tappable card list (thumb-friendly, no cramped table) */}
      <div
        className={`overflow-hidden rounded-card border border-[var(--border)] bg-surface md:hidden ${view !== "table" ? "hidden" : ""}`}
      >
        {isLoading && <p className="p-4 text-sm text-muted">Loading…</p>}
        {!isLoading && leads.length === 0 && (
          <p className="p-4 text-sm text-muted">No leads yet.</p>
        )}
        {leads.map((l) => {
          const contact = l.email ?? l.phone ?? "no contact yet";
          const enr = l.enrollments[0];
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => setSelectedId(l.id)}
              className="flex min-h-[64px] w-full items-center gap-3 border-b border-[var(--border)] px-4 py-3 text-left last:border-0 active:bg-surface-2/60"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{l.name}</span>
                  {l.isDemo && (
                    <span className="rounded-pill bg-surface-2 px-1.5 text-[10px] text-muted">
                      Demo
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-muted">
                  {contact}
                  {l.property?.name ? ` · ${l.property.name}` : ""}
                </div>
                {enr && (
                  <div className="mt-0.5 truncate text-[11px] text-muted">
                    🔁 {enr.sequence.name} · step {enr.currentStep + 1}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-[10px]">{pack.stageLabels[l.stage] ?? l.stage}</span>
                <span className="text-[10px] text-muted">{l.source}</span>
              </div>
              <span className="text-muted">›</span>
            </button>
          );
        })}
      </div>

      {/* Desktop: full table */}
      <div
        className={`overflow-hidden rounded-card border border-[var(--border)] bg-surface ${view === "table" ? "hidden md:block" : "hidden"}`}
      >
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-surface-2 text-xs text-muted">
            <tr>
              <th className="w-8 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={checked.size > 0 && checked.size === leads.length}
                  onChange={(e) =>
                    setChecked(
                      e.target.checked
                        ? new Set(applySmartView(leads, smartView).map((l) => l.id))
                        : new Set(),
                    )
                  }
                />
              </th>
              <th className="px-4 py-2.5 font-medium">Heat</th>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Phone</th>
              <th className="px-4 py-2.5 font-medium">Source</th>
              <th className="px-4 py-2.5 font-medium">{pack.context.singular}</th>
              <th className="px-4 py-2.5 font-medium">{pack.fields.timeframe}</th>
              <th className="px-4 py-2.5 font-medium">Stage</th>
              <th className="px-4 py-2.5 font-medium">Sequence</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && leads.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted">
                  No leads yet.
                </td>
              </tr>
            )}
            {applySmartView(leads, smartView).map((l) => {
              const contact = l.email ?? l.phone ?? "not provided (optional)";
              const enr = l.enrollments[0];
              return (
                <tr
                  key={l.id}
                  className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-surface-2/50"
                  onClick={() => setSelectedId(l.id)}
                >
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={checked.has(l.id)}
                      onChange={(e) => {
                        const next = new Set(checked);
                        if (e.target.checked) next.add(l.id);
                        else next.delete(l.id);
                        setChecked(next);
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <HeatDot heat={l.heat} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-medium">
                      {l.name}
                      {l.isDemo && (
                        <span className="rounded-pill bg-surface-2 px-1.5 text-[10px] font-normal text-muted">
                          Demo
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-ink-2">
                    {l.email ?? "-"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-2">{l.phone ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-xs">
                      {l.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-2">{l.property?.name ?? "-"}</td>
                  <td className="px-4 py-3 text-ink-2">{l.travelDates ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-xs">
                      {pack.stageLabels[l.stage] ?? l.stage}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-2">
                    {enr ? `${enr.sequence.name} · step ${enr.currentStep + 1}` : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedId && (
        <LeadDrawer
          leadId={selectedId}
          delivery={delivery}
          onClose={() => setSelectedId(null)}
          onSent={(msg) => {
            showToast(msg);
            qc.invalidateQueries({ queryKey: ["leads"] });
          }}
        />
      )}

      {importing && <ImportLeadsModal onClose={() => setImporting(false)} />}

      <Toast message={toast} />
    </div>
  );
}

function applySmartView<T extends BoardLead>(leads: T[], view: string): T[] {
  const now = Date.now();
  switch (view) {
    case "hot":
      return leads.filter((l) => l.heat.temp === "hot");
    case "attention":
      return leads.filter((l) => l.needsAttention);
    case "new7":
      return leads.filter((l) => now - new Date(l.createdAt).getTime() < 7 * 864e5);
    case "nonext":
      return leads.filter((l) => l.missingNextStep);
    case "cold":
      return leads.filter(
        (l) =>
          l.stage !== "BOOKED" &&
          l.stage !== "LOST" &&
          (!l.lastEventAt || now - new Date(l.lastEventAt).getTime() > 7 * 864e5),
      );
    default:
      return leads;
  }
}
