"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useVertical } from "@/components/vertical-provider";
import { AiSuggestionCard, type AiSuggestion } from "@/components/leads/ai-suggestion-card";
import { ComposePanel } from "@/components/leads/compose-panel";
import { EnrollPanel } from "@/components/leads/enroll-panel";
import { LeadTimeline, PendingMessagesList } from "@/components/leads/lead-timeline";
import {
  canEmailLead,
  canSmsLead,
  type LeadEnrollment,
  type LeadEvent,
  type PendingMessage,
} from "@/components/leads/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Toast, useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useMessagingStatus } from "@/lib/queries";

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
  pendingMessages: PendingMessage[];
  enrollments: LeadEnrollment[];
  aiSuggestion: AiSuggestion | null;
};

type OrgUser = { id: string; name: string; email: string };

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export default function LeadRecordPage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const router = useRouter();
  const qc = useQueryClient();
  const pack = useVertical();

  const { toast, showToast } = useToast();
  const [error, setError] = useState<string | null>(null);

  const [dealInput, setDealInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [codeInput, setCodeInput] = useState("");

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", id],
    queryFn: () => api<LeadDetail>(`/api/v1/leads/${id}`, { errorMessage: "Failed" }),
    enabled: Boolean(id),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["org-users"],
    queryFn: () => api<OrgUser[]>("/api/v1/org/users").catch(() => [] as OrgUser[]),
  });

  const { data: delivery } = useMessagingStatus();

  useEffect(() => {
    if (lead) {
      setDealInput(
        lead.dealValueCents == null ? "" : String(lead.dealValueCents / 100),
      );
    }
  }, [lead]);

  const update = useMutation({
    mutationFn: (patch: {
      stage?: string;
      tags?: string[];
      ownerId?: string | null;
      dealValueCents?: number | null;
      followUpAt?: string | null;
      needsAttention?: boolean;
    }) =>
      api(`/api/v1/leads/${id}`, {
        method: "PATCH",
        body: patch,
        errorMessage: "Update failed",
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["lead", id] });
      await qc.invalidateQueries({ queryKey: ["leads"] });
      showToast("Saved.");
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "Update failed"),
  });

  const logRedemption = useMutation({
    mutationFn: (code: string) =>
      api(`/api/v1/leads/${id}/redemptions`, {
        method: "POST",
        body: { code },
        errorMessage: "Could not log redemption",
      }),
    onSuccess: async () => {
      setCodeInput("");
      await qc.invalidateQueries({ queryKey: ["lead", id] });
      showToast("Redemption logged.");
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "Could not log redemption"),
  });

  const canEmail = canEmailLead(lead);
  const canSms = canSmsLead(lead);

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
        <Button variant="ghost" onClick={() => router.push("/leads")}>
          ← Leads
        </Button>
        <p className="text-sm text-muted">{isLoading ? "Loading…" : "Lead not found."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={() => router.push("/leads")}>
          ← Leads
        </Button>
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
            <Input
              id="deal-value"
              inputMode="decimal"
              className="mt-1"
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
            <h3 className="mb-1 text-sm font-semibold">Discount code</h3>
            <p className="mb-3 text-xs text-muted">
              Log when this lead redeems a promo code — feeds redemption analytics.
            </p>
            <div className="flex gap-2">
              <Input
                className="min-w-0 flex-1"
                value={codeInput}
                placeholder="e.g. WELCOME10"
                onChange={(e) => setCodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && codeInput.trim()) {
                    e.preventDefault();
                    logRedemption.mutate(codeInput.trim());
                  }
                }}
              />
              <Button
                variant="ghost"
                className="shrink-0 disabled:opacity-50"
                disabled={!codeInput.trim() || logRedemption.isPending}
                onClick={() => logRedemption.mutate(codeInput.trim())}
              >
                {logRedemption.isPending ? "Logging…" : "Log redemption"}
              </Button>
            </div>
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
              <Input
                className="min-w-0 flex-1"
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
              <Button
                variant="ghost"
                className="shrink-0 disabled:opacity-50"
                disabled={!tagInput.trim() || update.isPending}
                onClick={addTag}
              >
                Add
              </Button>
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
          {lead.aiSuggestion && (
            <AiSuggestionCard
              leadId={id}
              suggestion={lead.aiSuggestion}
              onToast={showToast}
            />
          )}
          <section className="rounded-card border border-[var(--border)] bg-surface p-4">
            <h3 className="mb-2 text-sm font-semibold">Conversation & activity</h3>
            <ComposePanel
              leadId={id}
              canEmail={canEmail}
              canSms={canSms}
              delivery={delivery}
              error={error}
              onError={setError}
              onSent={showToast}
            />

            <h4 className="mb-2 mt-6 text-sm font-semibold">Timeline</h4>
            <LeadTimeline events={lead.events} showEmoji />
          </section>
        </div>

        {/* RIGHT rail */}
        <div className="space-y-4 lg:col-span-3">
          <section className="rounded-card border border-[var(--border)] bg-surface p-4">
            <h3 className="mb-3 text-sm font-semibold">Automation</h3>
            <EnrollPanel
              leadId={id}
              enrollments={lead.enrollments}
              onError={setError}
              onEnrolled={showToast}
            />
            {lead.pendingMessages.length > 0 && (
              <PendingMessagesList
                className="mt-3"
                items={lead.pendingMessages}
                renderLabel={(m) =>
                  `✉️ in ${m.sequenceName} · ${new Date(m.sendAt).toLocaleString()}`
                }
              />
            )}
          </section>

          <section className="rounded-card border border-[var(--border)] bg-surface p-4">
            <h3 className="mb-3 text-sm font-semibold">Next step</h3>
            {lead.needsAttention ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-warn">Reply waiting on you</p>
                <Button
                  variant="ghost"
                  disabled={update.isPending}
                  onClick={() => update.mutate({ needsAttention: false })}
                >
                  Mark handled
                </Button>
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

      <Toast message={toast} />
    </div>
  );
}
