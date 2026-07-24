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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Toast, useToast } from "@/components/ui/toast";
import { usePlan, UpgradeChip } from "@/components/upgrade";
import { api } from "@/lib/api";
import { useMessagingStatus } from "@/lib/queries";

type Enrichment = {
  company: string | null;
  domain: string | null;
  isBusinessEmail: boolean;
  industry: string | null;
  role: string | null;
  location: string | null;
  linkedin: string | null;
  summary: string | null;
  talkingPoints: string[];
  sources: string[];
  provider?: object | null;
  inferred: boolean;
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
  pendingMessages: PendingMessage[];
  enrollments: LeadEnrollment[];
  aiSuggestion: AiSuggestion | null;
  enrichment: Enrichment | null;
  enrichedAt: string | null;
};

type OrgUser = { id: string; name: string; email: string };

type OrgReferral = {
  slug: string;
  link: string | null;
  stats: unknown;
};

type ExtractResult = {
  fields: {
    summary: string;
    interest: string | null;
    urgency: "low" | "medium" | "high" | null;
    budget: string | null;
    timeframe: string | null;
    partySize: string | null;
    tags: string[];
  };
  applied: {
    timeframe: boolean;
    partySize: boolean;
    tagsAdded: string[];
    noteAdded: boolean;
  };
};

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
  const { hasGrowth } = usePlan();

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

  const { data: referral } = useQuery({
    queryKey: ["org-referral"],
    queryFn: () =>
      api<OrgReferral>("/api/v1/org/referral").catch(
        () => ({ slug: "", link: null, stats: null }) as OrgReferral,
      ),
    staleTime: 5 * 60 * 1000,
  });

  const { data: orgTags } = useQuery({
    queryKey: ["org-tags"],
    queryFn: () =>
      api<{ tags: { tag: string; count: number }[] }>("/api/v1/org/tags").catch(
        () => ({ tags: [] as { tag: string; count: number }[] }),
      ),
    staleTime: 60 * 1000,
  });

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
      await qc.invalidateQueries({ queryKey: ["org-tags"] });
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

  const extract = useMutation({
    mutationFn: () =>
      api<ExtractResult>(`/api/v1/leads/${id}/extract`, {
        method: "POST",
        errorMessage: "Could not extract details",
      }),
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ["lead", id] });
      await qc.invalidateQueries({ queryKey: ["leads"] });
      const applied: string[] = [];
      const tagCount = data.applied.tagsAdded.length;
      if (tagCount) applied.push(`${tagCount} tag${tagCount > 1 ? "s" : ""}`);
      if (data.applied.timeframe) applied.push("timeframe");
      if (data.applied.partySize) applied.push(pack.fields.detail.toLowerCase());
      if (data.applied.noteAdded) applied.push("note");
      const summary =
        data.fields.summary.length > 80
          ? `${data.fields.summary.slice(0, 80)}…`
          : data.fields.summary;
      showToast(
        applied.length
          ? `${summary} · applied ${applied.join(", ")}`
          : `Found: ${summary}`,
      );
    },
    onError: (e) =>
      showToast(e instanceof Error ? e.message : "Could not extract details"),
  });

  const enrich = useMutation({
    mutationFn: () =>
      api<{ enrichment: Enrichment }>(`/api/v1/leads/${id}/enrich`, {
        method: "POST",
        errorMessage: "Could not enrich lead",
      }),
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ["lead", id] });
      await qc.invalidateQueries({ queryKey: ["leads"] });
      showToast(data.enrichment.summary?.trim() || "Enriched.");
    },
    onError: (e) => showToast(e instanceof Error ? e.message : "Could not enrich lead"),
  });

  const requestReview = useMutation({
    mutationFn: () =>
      api<{ ok: true; channel: "EMAIL" | "SMS" }>(`/api/v1/leads/${id}/review`, {
        method: "POST",
        errorMessage: "Could not send review request",
      }),
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ["lead", id] });
      showToast(`Review request sent (${data.channel})`);
    },
    onError: (e) =>
      showToast(e instanceof Error ? e.message : "Could not send review request"),
  });

  const copyReferralLink = async () => {
    if (!referral?.link) return;
    const url = `${referral.link}?ref=${id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Referral link copied");
    } catch {
      showToast("Could not copy referral link");
    }
  };

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

  const addTag = (value?: string) => {
    if (!lead) return;
    const t = (value ?? tagInput).trim();
    if (!t || lead.tags.includes(t)) return;
    update.mutate({ tags: [...lead.tags, t] });
    setTagInput("");
  };

  // Suggest the org's own tags this lead doesn't already have, most-used first.
  const tagSuggestions = (orgTags?.tags ?? [])
    .map((t) => t.tag)
    .filter((t) => lead && !lead.tags.includes(t))
    .slice(0, 8);

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
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Contact</h3>
              {hasGrowth && (
                <Button
                  variant="link"
                  size="sm"
                  disabled={extract.isPending}
                  onClick={() => extract.mutate()}
                  title="Read the conversation and fill in interest, timeframe, tags…"
                >
                  {extract.isPending ? "Extracting…" : "✨ Extract details"}
                </Button>
              )}
            </div>
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
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Enrichment</h3>
                {!hasGrowth && <UpgradeChip />}
              </div>
              {hasGrowth ? (
                <Button
                  variant="link"
                  size="sm"
                  disabled={enrich.isPending}
                  onClick={() => enrich.mutate()}
                  title="Look up company, role, industry and talking points for this lead"
                >
                  {enrich.isPending
                    ? "Enriching…"
                    : lead.enrichment
                      ? "Re-enrich"
                      : "✨ Enrich"}
                </Button>
              ) : (
                <span className="text-[10px] text-muted">Included with Growth</span>
              )}
            </div>
            {lead.enrichment ? (
              <div className="space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={lead.enrichment.inferred ? "muted" : "good"} size="xs">
                    {lead.enrichment.inferred ? "AI-inferred" : "Verified"}
                  </Badge>
                  {!lead.enrichment.isBusinessEmail && (
                    <span className="text-[10px] text-muted">Personal email</span>
                  )}
                </div>
                {lead.enrichment.company && (
                  <div>
                    <div className="text-muted">Company</div>
                    <div className="mt-0.5 font-medium text-ink">
                      {lead.enrichment.company}
                    </div>
                  </div>
                )}
                {lead.enrichment.industry && (
                  <div>
                    <div className="text-muted">Industry</div>
                    <div className="mt-0.5 text-ink-2">{lead.enrichment.industry}</div>
                  </div>
                )}
                {lead.enrichment.role && (
                  <div>
                    <div className="text-muted">Role</div>
                    <div className="mt-0.5 text-ink-2">{lead.enrichment.role}</div>
                  </div>
                )}
                {lead.enrichment.location && (
                  <div>
                    <div className="text-muted">Location</div>
                    <div className="mt-0.5 text-ink-2">{lead.enrichment.location}</div>
                  </div>
                )}
                {lead.enrichment.linkedin && (
                  <div>
                    <a
                      href={lead.enrichment.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      LinkedIn ↗
                    </a>
                  </div>
                )}
                {lead.enrichment.summary && (
                  <p className="text-muted">{lead.enrichment.summary}</p>
                )}
                {lead.enrichment.talkingPoints.length > 0 && (
                  <div>
                    <div className="text-muted">Talking points</div>
                    <ul className="mt-1 space-y-1">
                      {lead.enrichment.talkingPoints.map((tp, i) => (
                        <li key={i} className="flex gap-1.5 text-ink-2">
                          <span className="text-muted">•</span>
                          <span>{tp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {lead.enrichment.sources.length > 0 && (
                  <p className="text-[10px] text-muted">
                    via {lead.enrichment.sources.join(", ")}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted">
                {hasGrowth
                  ? "Look up company, role, and talking points for this lead."
                  : "Auto-fill company, role, and talking points on the Growth plan."}
              </p>
            )}
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
                list="lead-tag-suggestions"
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <datalist id="lead-tag-suggestions">
                {(orgTags?.tags ?? []).map((t) => (
                  <option key={t.tag} value={t.tag} />
                ))}
              </datalist>
              <Button
                variant="ghost"
                className="shrink-0 disabled:opacity-50"
                disabled={!tagInput.trim() || update.isPending}
                onClick={() => addTag()}
              >
                Add
              </Button>
            </div>
            {tagSuggestions.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-muted">Your tags:</span>
                {tagSuggestions.map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={update.isPending}
                    onClick={() => addTag(t)}
                    className="rounded-pill border border-[var(--border)] bg-surface-2 px-2 py-0.5 text-xs text-muted transition-colors hover:text-ink disabled:opacity-50"
                  >
                    + {t}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-card border border-[var(--border)] bg-surface p-4">
            <h3 className="mb-3 text-sm font-semibold">Grow</h3>
            <div className="flex flex-col items-start gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={requestReview.isPending}
                onClick={() => requestReview.mutate()}
                title="Ask this lead to leave a review"
              >
                {requestReview.isPending ? "Sending…" : "⭐ Request review"}
              </Button>
              {referral?.link ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyReferralLink}
                  title="Copy this lead's personal referral link"
                >
                  🎁 Refer a friend
                </Button>
              ) : (
                <span className="px-1 text-xs text-muted">
                  Set a booking page to enable referrals
                </span>
              )}
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
