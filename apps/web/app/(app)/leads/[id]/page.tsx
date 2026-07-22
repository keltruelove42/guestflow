"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useVertical } from "@/components/vertical-provider";

type LeadEvent = {
  id: string;
  type: string;
  channel: string | null;
  title: string;
  body: string | null;
  occurredAt: string;
  meta: { delivery?: string; providerId?: string } | null;
};

type LeadDetail = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  stage: string;
  source: string;
  travelDates: string | null;
  partySize: string | null;
  emailConsent: boolean;
  smsConsent: boolean;
  unsubscribedAt: string | null;
  smsStoppedAt: string | null;
  isDemo?: boolean;
  property?: { name: string } | null;
  tags: string[];
  ownerId: string | null;
  dealValueCents: number | null;
  followUpAt: string | null;
  needsAttention: boolean;
  createdAt: string;
  events: LeadEvent[];
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

type OrgUser = { id: string; name: string; email: string };

type DeliveryStatus = {
  orgMode: string;
  sendMode: string | null;
  email: "live" | "log";
  sms: "live" | "log";
  emailFrom: string | null;
};

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function eventEmoji(ev: LeadEvent): string {
  if (ev.type === "SMS_SENT" || (ev.type === "REPLIED" && ev.channel === "SMS")) return "💬";
  if (ev.type === "EMAIL_SENT") return "✉️";
  return "🕐";
}

export default function LeadRecordPage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const router = useRouter();
  const qc = useQueryClient();
  const pack = useVertical();

  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [channel, setChannel] = useState<"EMAIL" | "SMS">("EMAIL");
  const [subject, setSubject] = useState("Following up on your stay");
  const [body, setBody] = useState(
    "Hi {{first_name}},\n\nJust checking in about {{property}}. Happy to answer any questions or hold dates for you.\n\n- {{host_name}}",
  );
  const [dealInput, setDealInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [enrollSeqId, setEnrollSeqId] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/leads/${id}`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<LeadDetail>;
    },
    enabled: Boolean(id),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["org-users"],
    queryFn: async () => {
      const res = await fetch("/api/v1/org/users");
      if (!res.ok) return [];
      return res.json() as Promise<OrgUser[]>;
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

  const { data: delivery } = useQuery({
    queryKey: ["messaging-status"],
    queryFn: async () => {
      const res = await fetch("/api/v1/messaging/status");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<DeliveryStatus>;
    },
  });

  useEffect(() => {
    if (lead) {
      setDealInput(
        lead.dealValueCents == null ? "" : String(lead.dealValueCents / 100),
      );
    }
  }, [lead]);

  const update = useMutation({
    mutationFn: async (patch: {
      stage?: string;
      tags?: string[];
      ownerId?: string | null;
      dealValueCents?: number | null;
      followUpAt?: string | null;
      needsAttention?: boolean;
    }) => {
      const res = await fetch(`/api/v1/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Update failed");
      }
      return res.json();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["lead", id] });
      await qc.invalidateQueries({ queryKey: ["leads"] });
      showToast("Saved.");
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "Update failed"),
  });

  const enroll = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/leads/${id}/enroll`, {
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
      await qc.invalidateQueries({ queryKey: ["lead", id] });
      await qc.invalidateQueries({ queryKey: ["leads"] });
      showToast("Enrolled, first step scheduled.");
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Enroll failed"),
  });

  const send = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/leads/${id}/messages`, {
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
      await qc.invalidateQueries({ queryKey: ["lead", id] });
      const mode =
        r.delivery === "live"
          ? "Delivered"
          : "Logged (demo, not delivered externally)";
      showToast(`${r.channel} sent. ${mode}.`);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Send failed"),
  });

  const canEmail =
    Boolean(lead?.email) && Boolean(lead?.emailConsent) && !lead?.unsubscribedAt;
  const canSms =
    Boolean(lead?.phone) && Boolean(lead?.smsConsent) && !lead?.smsStoppedAt;

  const activeEnr = lead?.enrollments.find(
    (e) => e.status === "ACTIVE" || e.status === "PAUSED",
  );
  const nextPending = lead?.pendingMessages
    .slice()
    .sort((a, b) => new Date(a.sendAt).getTime() - new Date(b.sendAt).getTime())[0];

  const commitDealValue = () => {
    if (!lead) return;
    const trimmed = dealInput.trim();
    if (trimmed === "") {
      if (lead.dealValueCents != null) update.mutate({ dealValueCents: null });
      return;
    }
    const dollars = Number(trimmed);
    if (Number.isNaN(dollars)) {
      setDealInput(
        lead.dealValueCents == null ? "" : String(lead.dealValueCents / 100),
      );
      return;
    }
    const cents = Math.round(dollars * 100);
    if (cents !== lead.dealValueCents) update.mutate({ dealValueCents: cents });
  };

  const addTag = () => {
    if (!lead) return;
    const t = tagInput.trim();
    if (!t || lead.tags.includes(t)) return;
    update.mutate({ tags: [...lead.tags, t] });
    setTagInput("");
  };

  const followUpButtons = (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="rounded-control border border-[var(--border)] px-3 py-2 text-xs"
        disabled={update.isPending}
        onClick={() => update.mutate({ followUpAt: addDaysIso(1) })}
      >
        Tomorrow
      </button>
      <button
        type="button"
        className="rounded-control border border-[var(--border)] px-3 py-2 text-xs"
        disabled={update.isPending}
        onClick={() => update.mutate({ followUpAt: addDaysIso(3) })}
      >
        In 3 days
      </button>
      <button
        type="button"
        className="rounded-control border border-[var(--border)] px-3 py-2 text-xs"
        disabled={update.isPending}
        onClick={() => update.mutate({ followUpAt: addDaysIso(7) })}
      >
        Next week
      </button>
    </div>
  );

  if (isLoading || !lead) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          className="rounded-control border border-[var(--border)] px-3 py-2 text-sm"
          onClick={() => router.push("/leads")}
        >
          ← Leads
        </button>
        <p className="text-sm text-muted">{isLoading ? "Loading…" : "Lead not found."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-control border border-[var(--border)] px-3 py-2 text-sm"
          onClick={() => router.push("/leads")}
        >
          ← Leads
        </button>
        <h1 className="text-xl font-bold">{lead.name}</h1>
        {lead.isDemo && (
          <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-[10px] text-muted">
            Demo
          </span>
        )}
        <select
          className="ml-auto rounded-control border border-[var(--border)] bg-page px-2.5 py-2 text-sm outline-none"
          value={lead.stage}
          disabled={update.isPending}
          onChange={(e) => update.mutate({ stage: e.target.value })}
        >
          {Object.entries(pack.stageLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* LEFT rail */}
        <div className="space-y-4 lg:col-span-3">
          <section className="rounded-card border border-[var(--border)] bg-surface p-4">
            <h3 className="mb-3 text-sm font-semibold">Contact</h3>
            <div className="space-y-3 text-xs">
              <div>
                <div className="text-muted">Email</div>
                <div className="mt-0.5 font-medium text-ink">{lead.email ?? "-"}</div>
                <div className="text-muted">{canEmail ? "consent ok" : "cannot send"}</div>
              </div>
              <div>
                <div className="text-muted">Phone</div>
                <div className="mt-0.5 font-medium text-ink">{lead.phone ?? "-"}</div>
                <div className="text-muted">{canSms ? "consent ok" : "cannot send"}</div>
              </div>
              <div>
                <div className="text-muted">Source</div>
                <div className="mt-1">
                  <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-xs">
                    {lead.source}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-muted">Created</div>
                <div className="mt-0.5 text-ink-2">
                  {new Date(lead.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div>
                <div className="text-muted">{pack.context.singular}</div>
                <div className="mt-0.5 text-ink-2">{lead.property?.name ?? "-"}</div>
              </div>
              <div>
                <div className="text-muted">{pack.fields.timeframe}</div>
                <div className="mt-0.5 text-ink-2">{lead.travelDates ?? "-"}</div>
              </div>
              <div>
                <div className="text-muted">{pack.fields.detail}</div>
                <div className="mt-0.5 text-ink-2">{lead.partySize ?? "-"}</div>
              </div>
            </div>
          </section>

          <section className="rounded-card border border-[var(--border)] bg-surface p-4">
            <h3 className="mb-3 text-sm font-semibold">Deal</h3>
            <label className="block text-xs text-muted" htmlFor="deal-value">
              Deal value ($)
            </label>
            <input
              id="deal-value"
              inputMode="decimal"
              className="mt-1 w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
              value={dealInput}
              placeholder="0"
              onChange={(e) => setDealInput(e.target.value)}
              onBlur={commitDealValue}
            />
            <label className="mt-3 block text-xs text-muted" htmlFor="deal-owner">
              Owner
            </label>
            <select
              id="deal-owner"
              className="mt-1 w-full rounded-control border border-[var(--border)] bg-page px-2.5 py-2 text-sm outline-none"
              value={lead.ownerId ?? ""}
              disabled={update.isPending}
              onChange={(e) => update.mutate({ ownerId: e.target.value || null })}
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
          </section>

          <section className="rounded-card border border-[var(--border)] bg-surface p-4">
            <h3 className="mb-3 text-sm font-semibold">Tags</h3>
            <div className="flex flex-wrap gap-1.5">
              {lead.tags.map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1 rounded-pill bg-surface-2 px-2 py-0.5 text-xs"
                >
                  {t}
                  <button
                    type="button"
                    aria-label={`Remove tag ${t}`}
                    className="flex h-5 w-5 items-center justify-center rounded-pill text-muted"
                    disabled={update.isPending}
                    onClick={() =>
                      update.mutate({ tags: lead.tags.filter((x) => x !== t) })
                    }
                  >
                    ✕
                  </button>
                </span>
              ))}
              {lead.tags.length === 0 && (
                <span className="text-xs text-muted">No tags yet.</span>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
                value={tagInput}
                placeholder="Add a tag"
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <button
                type="button"
                className="shrink-0 rounded-control border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-50"
                disabled={!tagInput.trim() || update.isPending}
                onClick={addTag}
              >
                Add
              </button>
            </div>
          </section>

          <section className="rounded-card border border-[var(--border)] bg-surface p-4">
            <h3 className="mb-3 text-sm font-semibold">Follow-up</h3>
            {lead.followUpAt ? (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-ink-2">
                  {new Date(lead.followUpAt).toLocaleDateString()}
                </span>
                <button
                  type="button"
                  className="rounded-control border border-[var(--border)] px-3 py-2 text-xs"
                  disabled={update.isPending}
                  onClick={() => update.mutate({ followUpAt: null })}
                >
                  Clear
                </button>
              </div>
            ) : (
              followUpButtons
            )}
          </section>
        </div>

        {/* CENTER */}
        <div className="lg:col-span-6">
          <section className="rounded-card border border-[var(--border)] bg-surface p-4">
            <h3 className="mb-2 text-sm font-semibold">Conversation & activity</h3>
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

            <h4 className="mb-2 mt-6 text-sm font-semibold">Timeline</h4>
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
                  <div className="text-sm font-medium">
                    {eventEmoji(ev)} {ev.title}
                  </div>
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
        </div>

        {/* RIGHT rail */}
        <div className="space-y-4 lg:col-span-3">
          <section className="rounded-card border border-[var(--border)] bg-surface p-4">
            <h3 className="mb-3 text-sm font-semibold">Automation</h3>
            {activeEnr ? (
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
            )}
            {lead.pendingMessages.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-xs text-ink-2">
                {lead.pendingMessages.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-control border border-[var(--border)] px-2.5 py-1.5"
                  >
                    ✉️ in {m.sequenceName} · {new Date(m.sendAt).toLocaleString()}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-card border border-[var(--border)] bg-surface p-4">
            <h3 className="mb-3 text-sm font-semibold">Next step</h3>
            {lead.needsAttention ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-warn">Reply waiting on you</p>
                <button
                  type="button"
                  className="rounded-control border border-[var(--border)] px-3 py-2 text-sm"
                  disabled={update.isPending}
                  onClick={() => update.mutate({ needsAttention: false })}
                >
                  Mark handled
                </button>
              </div>
            ) : activeEnr ? (
              <div className="text-sm text-ink-2">
                Automation is on it
                {nextPending
                  ? ` · next send ${new Date(nextPending.sendAt).toLocaleString()}`
                  : ""}
              </div>
            ) : lead.followUpAt ? (
              <div className="text-sm text-ink-2">
                Follow up {new Date(lead.followUpAt).toLocaleDateString()}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-critical">No next step set</p>
                <p className="text-xs text-muted">
                  Set a follow-up or enroll in a sequence so this lead is never
                  stranded.
                </p>
                {followUpButtons}
              </div>
            )}
          </section>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-20 left-4 right-4 z-50 rounded-card border border-[var(--border)] bg-surface px-4 py-3 text-sm shadow-lg md:bottom-4 md:left-auto md:max-w-sm">
          {toast}
        </div>
      )}
    </div>
  );
}
