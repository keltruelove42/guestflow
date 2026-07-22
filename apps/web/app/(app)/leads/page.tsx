"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useOnboardingOptional } from "@/components/onboarding/onboarding-provider";
import { ImportLeadsModal } from "@/components/import-leads-modal";
import { useVertical } from "@/components/vertical-provider";

type Lead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  stage: string;
  source: string;
  travelDates: string | null;
  emailConsent: boolean;
  smsConsent: boolean;
  unsubscribedAt: string | null;
  smsStoppedAt: string | null;
  isDemo?: boolean;
  property?: { name: string } | null;
  enrollments: Array<{ sequence: { name: string }; currentStep: number }>;
  createdAt: string;
};

type LeadDetail = Omit<Lead, "enrollments"> & {
  events: Array<{
    id: string;
    type: string;
    channel: string | null;
    title: string;
    body: string | null;
    occurredAt: string;
    meta: { delivery?: string; providerId?: string } | null;
  }>;
  pendingMessages: Array<{
    id: string;
    channel: string;
    sendAt: string;
    sequenceName: string;
  }>;
  enrollments: Array<{
    status: string;
    currentStep: number;
    sequence: { name: string };
  }>;
};

type DeliveryStatus = {
  orgMode: string;
  sendMode: string | null;
  email: "live" | "log";
  sms: "live" | "log";
  emailFrom: string | null;
};

export default function LeadsPage() {
  const searchParams = useSearchParams();
  const property = searchParams.get("property");
  const openId = searchParams.get("open");
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const pack = useVertical();

  useEffect(() => {
    if (openId) setSelectedId(openId);
  }, [openId]);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", property],
    queryFn: async () => {
      const qs = property ? `property=${property}` : "";
      const res = await fetch(`/api/v1/leads${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<Lead[]>;
    },
  });

  const { data: delivery } = useQuery({
    queryKey: ["messaging-status"],
    queryFn: async () => {
      const res = await fetch("/api/v1/messaging/status");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<DeliveryStatus>;
    },
  });

  const tick = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/simulate/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advanceMinutes: 60 * 24 * 14 }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Tick failed");
      }
      return res.json() as Promise<{ sent: number; skipped: number }>;
    },
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ["leads"] });
      if (selectedId) await qc.invalidateQueries({ queryKey: ["lead", selectedId] });
      setToast(`Sent ${r.sent ?? 0} due message(s)${r.skipped ? ` (${r.skipped} skipped)` : ""}.`);
      setTimeout(() => setToast(null), 4000);
    },
    onError: (e) => {
      setToast(e instanceof Error ? e.message : "Tick failed");
      setTimeout(() => setToast(null), 4000);
    },
  });

  return (
    <div className="space-y-4">
      <div className="hidden flex-wrap items-start justify-between gap-3 md:flex">
        <p className="max-w-xl text-sm text-ink-2">
          {pack.copy.leadsPageHint}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-control border border-[var(--border)] px-3 py-2 text-sm"
            onClick={() => setImporting(true)}
          >
            ⬆️ Import past inquiries
          </button>
          <button
            type="button"
            className="rounded-control border border-[var(--border)] px-3 py-2 text-sm"
            disabled={tick.isPending}
            onClick={() => tick.mutate()}
          >
            {tick.isPending ? "Sending…" : "Send due sequences now"}
          </button>
        </div>
      </div>

      {/* Mobile: compact import button */}
      <div className="flex justify-end md:hidden">
        <button
          type="button"
          className="rounded-control border border-[var(--border)] px-3 py-2 text-sm"
          onClick={() => setImporting(true)}
        >
          ⬆️ Import
        </button>
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
              — set{" "}
              <code className="rounded bg-surface px-1">SEND_MODE=live</code> plus{" "}
              <code className="rounded bg-surface px-1">RESEND_API_KEY</code> / Twilio env vars to
              deliver for real.
            </span>
          )}
        </div>
      )}

      {/* Mobile: tappable card list (thumb-friendly, no cramped table) */}
      <div className="overflow-hidden rounded-card border border-[var(--border)] bg-surface md:hidden">
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
      <div className="hidden overflow-hidden rounded-card border border-[var(--border)] bg-surface md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-surface-2 text-xs text-muted">
            <tr>
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
                <td colSpan={8} className="px-4 py-8 text-center text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && leads.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted">
                  No leads yet.
                </td>
              </tr>
            )}
            {leads.map((l) => {
              const contact = l.email ?? l.phone ?? "not provided (optional)";
              const enr = l.enrollments[0];
              return (
                <tr
                  key={l.id}
                  className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-surface-2/50"
                  onClick={() => setSelectedId(l.id)}
                >
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
                    {l.email ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-2">{l.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-xs">
                      {l.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-2">{l.property?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-2">{l.travelDates ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-xs">
                      {pack.stageLabels[l.stage] ?? l.stage}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-2">
                    {enr ? `${enr.sequence.name} · step ${enr.currentStep + 1}` : "—"}
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
            setToast(msg);
            setTimeout(() => setToast(null), 4500);
            qc.invalidateQueries({ queryKey: ["leads"] });
          }}
        />
      )}

      {importing && <ImportLeadsModal onClose={() => setImporting(false)} />}

      {toast && (
        <div className="fixed bottom-20 left-4 right-4 z-50 rounded-card border border-[var(--border)] bg-surface px-4 py-3 text-sm shadow-lg md:bottom-4 md:left-auto md:max-w-sm">
          {toast}
        </div>
      )}
    </div>
  );
}

function LeadDrawer({
  leadId,
  delivery,
  onClose,
  onSent,
}: {
  leadId: string;
  delivery?: DeliveryStatus;
  onClose: () => void;
  onSent: (msg: string) => void;
}) {
  const qc = useQueryClient();
  const onboarding = useOnboardingOptional();
  const [channel, setChannel] = useState<"EMAIL" | "SMS">("EMAIL");
  const [subject, setSubject] = useState("Following up on your stay");
  const [body, setBody] = useState(
    "Hi {{first_name}},\n\nJust checking in about {{property}}. Happy to answer any questions or hold dates for you.\n\n— {{host_name}}",
  );
  const [error, setError] = useState<string | null>(null);

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", leadId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/leads/${leadId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<LeadDetail>;
    },
  });

  const { data: sequences = [] } = useQuery({
    queryKey: ["sequences"],
    queryFn: async () => {
      const res = await fetch("/api/v1/sequences");
      if (!res.ok) return [];
      return res.json() as Promise<Array<{ id: string; name: string; active: boolean }>>;
    },
  });
  const [enrollSeqId, setEnrollSeqId] = useState("");

  const enroll = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/leads/${leadId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sequenceId: enrollSeqId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Enroll failed");
      }
      return res.json();
    },
    onSuccess: async () => {
      setError(null);
      await qc.invalidateQueries({ queryKey: ["lead", leadId] });
      await qc.invalidateQueries({ queryKey: ["leads"] });
      onSent("Enrolled — first step scheduled.");
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Enroll failed"),
  });

  const send = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/leads/${leadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          subject: channel === "EMAIL" ? subject : undefined,
          body,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Send failed");
      }
      return res.json() as Promise<{ delivery: string; channel: string }>;
    },
    onSuccess: async (r) => {
      setError(null);
      onboarding?.markAction("message");
      await qc.invalidateQueries({ queryKey: ["lead", leadId] });
      await qc.invalidateQueries({ queryKey: ["onboarding-status"] });
      const mode =
        r.delivery === "live"
          ? "Delivered"
          : "Logged (demo — not delivered externally)";
      onSent(`${r.channel} sent. ${mode}.`);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Send failed"),
  });

  const canEmail =
    Boolean(lead?.email) && lead?.emailConsent && !lead?.unsubscribedAt;
  const canSms = Boolean(lead?.phone) && lead?.smsConsent && !lead?.smsStoppedAt;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-md flex-col border-l border-[var(--border)] bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">{lead?.name ?? "Lead"}</h2>
            <p className="text-xs text-muted">
              {lead?.stage}
              {lead?.property?.name ? ` · ${lead.property.name}` : ""}
            </p>
          </div>
          <button
            type="button"
            className="-mr-2 flex h-10 min-w-[44px] items-center justify-center rounded-control px-2 text-sm text-muted active:bg-surface-2"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-auto p-4 pb-[calc(20px+env(safe-area-inset-bottom))] md:p-5">
          {isLoading && <p className="text-sm text-muted">Loading…</p>}
          {lead && (
            <>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-control bg-surface-2 p-2">
                  <div className="text-muted">Email</div>
                  <div className="mt-0.5 font-medium text-ink">{lead.email ?? "—"}</div>
                  <div className="text-muted">
                    {canEmail ? "consent ok" : "cannot send"}
                  </div>
                </div>
                <div className="rounded-control bg-surface-2 p-2">
                  <div className="text-muted">Phone</div>
                  <div className="mt-0.5 font-medium text-ink">{lead.phone ?? "—"}</div>
                  <div className="text-muted">{canSms ? "consent ok" : "cannot send"}</div>
                </div>
              </div>

              <section>
                <h3 className="mb-2 text-sm font-semibold">Follow-up sequence</h3>
                {(() => {
                  const enr = lead.enrollments.find(
                    (e) => e.status === "ACTIVE" || e.status === "PAUSED",
                  );
                  return enr ? (
                  <div className="rounded-control border border-[var(--border)] bg-surface-2 px-3 py-2 text-xs text-ink-2">
                    🔁 {enr.sequence.name} · step {enr.currentStep + 1} ·{" "}
                    {enr.status.toLowerCase()}
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
                })()}
              </section>

              <section>
                <h3 className="mb-2 text-sm font-semibold">Compose</h3>
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
                  <input
                    className="mb-2 w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Subject"
                  />
                )}
                <textarea
                  className="min-h-[120px] w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-muted">
                  Merge tags: {"{{first_name}}"}, {"{{property}}"}, {"{{host_name}}"},{" "}
                  {"{{dates}}"}
                </p>
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
              </section>

              {lead.pendingMessages.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold">Pending</h3>
                  <ul className="space-y-1.5 text-xs text-ink-2">
                    {lead.pendingMessages.map((m) => (
                      <li
                        key={m.id}
                        className="rounded-control border border-[var(--border)] px-2.5 py-1.5"
                      >
                        {m.channel} · {m.sequenceName} ·{" "}
                        {new Date(m.sendAt).toLocaleString()}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <h3 className="mb-2 text-sm font-semibold">Timeline</h3>
                <ul className="space-y-3">
                  {lead.events.map((ev) => (
                    <li key={ev.id} className="border-l-2 border-[var(--border)] pl-3">
                      <div className="text-xs text-muted">
                        {new Date(ev.occurredAt).toLocaleString()}
                        {ev.meta &&
                        typeof ev.meta === "object" &&
                        "delivery" in ev.meta &&
                        ev.meta.delivery
                          ? ` · ${ev.meta.delivery}`
                          : ""}
                      </div>
                      <div className="text-sm font-medium">{ev.title}</div>
                      {ev.body && (
                        <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-xs text-ink-2">
                          {ev.body}
                        </p>
                      )}
                    </li>
                  ))}
                  {lead.events.length === 0 && (
                    <li className="text-xs text-muted">No activity yet.</li>
                  )}
                </ul>
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
