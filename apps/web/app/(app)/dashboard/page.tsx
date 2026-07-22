"use client";

import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { WeeklyLeadsChart, type WeekRow } from "@/components/dashboard/weekly-chart";
import { SourceBars } from "@/components/dashboard/source-bars";
import { useOnboardingOptional } from "@/components/onboarding/onboarding-provider";
import { useVertical } from "@/components/vertical-provider";
import { ONBOARDING_STEPS } from "@/lib/onboarding";
import {
  activityIcon,
  formatCents,
  relativeTime,
  stageCssVar,
} from "@/lib/format";

type Kpis = {
  newLeads30d: number;
  newLeadsDeltaPct: number;
  blendedCplCents: number;
  cplDeltaCents: number;
  replyRatePct: number;
  enrolledAllTime: number;
  recoveredBookings: number;
  attributedRevenueCents: number;
};

type Activity = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  occurredAt: string;
  leadId: string;
  leadName: string;
  propertyName: string | null;
};

type Attention = {
  id: string;
  name: string;
  stage: string;
  travelDates: string | null;
  property: { name: string } | null;
};

function DashboardInner() {
  const searchParams = useSearchParams();
  const property = searchParams.get("property");
  const qs = property ? `propertyId=${property}` : "";
  const onboarding = useOnboardingOptional();
  const pack = useVertical();

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ["dashboard-kpis", property],
    queryFn: async () => {
      const res = await fetch(`/api/v1/dashboard/kpis${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<Kpis>;
    },
  });

  const { data: weeks = [] } = useQuery({
    queryKey: ["dashboard-weeks", property],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/dashboard/leads-by-week?weeks=8${qs ? `&${qs}` : ""}`,
      );
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<WeekRow[]>;
    },
  });

  const { data: bySource = [] } = useQuery({
    queryKey: ["dashboard-source", property],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/dashboard/leads-by-source${qs ? `?${qs}` : ""}`,
      );
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<Array<{ source: string; count: number }>>;
    },
  });

  const { data: activity = [] } = useQuery({
    queryKey: ["activity"],
    queryFn: async () => {
      const res = await fetch("/api/v1/activity?limit=8");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<Activity[]>;
    },
  });

  const { data: attention = [], isLoading: attentionLoading } = useQuery({
    queryKey: ["attention", property],
    queryFn: async () => {
      const res = await fetch(`/api/v1/attention${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<Attention[]>;
    },
  });

  const nextStep = onboarding
    ? ONBOARDING_STEPS.find((s) => !onboarding.isDone(s.id))
    : null;
  const showOnboarding =
    onboarding?.ready &&
    !onboarding.local.checklistDismissed &&
    onboarding.stats.pct < 100;

  const propLabel = property ? "filtered" : "all properties";

  return (
    <div className="space-y-4">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiTile
          label={pack.kpis.newLeads}
          value={kpisLoading ? "-" : String(kpis?.newLeads30d ?? 0)}
          delta={
            kpis ? (
              <span
                style={{
                  color:
                    kpis.newLeadsDeltaPct >= 0
                      ? "var(--good-text)"
                      : "var(--critical)",
                }}
              >
                {kpis.newLeadsDeltaPct >= 0 ? "▲" : "▼"}{" "}
                {Math.abs(kpis.newLeadsDeltaPct)}% vs prior 30d
              </span>
            ) : null
          }
        />
        <KpiTile
          label={pack.kpis.costPerLead}
          value={
            kpisLoading
              ? "-"
              : kpis && kpis.blendedCplCents > 0
                ? formatCents(kpis.blendedCplCents)
                : "-"
          }
          delta={
            kpis && kpis.blendedCplCents > 0 ? (
              <span style={{ color: "var(--good-text)" }}>
                ▼ {formatCents(Math.abs(kpis.cplDeltaCents))} vs prior 30d
              </span>
            ) : (
              <span className="text-muted">From campaign spend</span>
            )
          }
        />
        <KpiTile
          label={pack.kpis.replyRate}
          value={kpisLoading ? "-" : `${kpis?.replyRatePct ?? 0}%`}
          delta={
            <span className="text-muted">
              {kpis?.enrolledAllTime ?? 0} enrolled all-time
            </span>
          }
        />
        <KpiTile
          label={pack.kpis.recovered}
          value={kpisLoading ? "-" : String(kpis?.recoveredBookings ?? 0)}
          delta={
            <span style={{ color: "var(--good-text)" }} className="font-medium tabular-nums">
              {formatCents(kpis?.attributedRevenueCents ?? 0)} attributed revenue
            </span>
          }
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <section className="rounded-card border border-[var(--border)] bg-surface">
          <CardHeader
            title="New leads per week"
            sub={`last 8 weeks · ${propLabel}`}
          />
          <WeeklyLeadsChart weeks={weeks} />
        </section>
        <section className="rounded-card border border-[var(--border)] bg-surface">
          <CardHeader title="Leads by source" sub="all-time" />
          <SourceBars rows={bySource} />
        </section>
      </div>

      {/* Activity + attention */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-card border border-[var(--border)] bg-surface">
          <CardHeader title="Recent activity" sub="automation log" />
          <div className="space-y-0 px-4 pb-4">
            {activity.length === 0 && (
              <p className="py-6 text-sm text-muted">No activity yet.</p>
            )}
            {activity.map((a) => (
              <div
                key={a.id}
                className="flex gap-3 border-b border-[var(--border)] py-2.5 last:border-0"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm">
                  {activityIcon(a.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-snug text-ink">
                    <Link
                      href={`/leads?open=${a.leadId}`}
                      className="font-semibold hover:underline"
                    >
                      {a.leadName}
                    </Link>
                    <span className="text-ink-2"> · {a.title}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {relativeTime(a.occurredAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-card border border-[var(--border)] bg-surface">
          <CardHeader
            title="Needs your attention"
            sub="automation paused → human reply"
          />
          <div className="px-4 pb-4">
            {attentionLoading && (
              <p className="py-6 text-sm text-muted">Loading…</p>
            )}
            {!attentionLoading && attention.length === 0 && (
              <p className="py-6 text-sm text-muted">Nothing waiting on you.</p>
            )}
            <ul className="space-y-1">
              {attention.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center gap-3 rounded-control px-1 py-2 hover:bg-surface-2/70"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm">
                    💬
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold">{l.name}</span>
                      <span className="inline-flex items-center gap-1 rounded-pill bg-surface-2 px-2 py-0.5 text-[10px]">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: stageCssVar(l.stage) }}
                        />
                        {l.stage.charAt(0) + l.stage.slice(1).toLowerCase()}
                      </span>
                    </div>
                    <p className="truncate text-[11px] text-muted">
                      {l.property?.name ?? "-"} · {l.travelDates ?? "dates TBD"}
                    </p>
                  </div>
                  <Link
                    href={`/leads?open=${l.id}`}
                    className="shrink-0 rounded-control border border-[var(--border)] px-2.5 py-1 text-xs"
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      {showOnboarding && (
        <section className="rounded-card border border-dashed border-[var(--border)] bg-surface/80 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">
                Getting started · {onboarding.stats.done}/{onboarding.stats.total}
              </p>
              <p className="text-xs text-muted">
                {nextStep
                  ? `Next: ${nextStep.title}`
                  : "Finish the checklist to activate LeadCoda."}
              </p>
            </div>
            <div className="flex gap-2">
              {nextStep && (
                <Link
                  href={nextStep.href}
                  className="rounded-control bg-accent px-3 py-1.5 text-xs font-medium text-white"
                >
                  Continue
                </Link>
              )}
              <button
                type="button"
                className="rounded-control border border-[var(--border)] px-3 py-1.5 text-xs"
                onClick={() => onboarding.startTour()}
              >
                Tips
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function CardHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      <span className="text-[11px] text-muted">{sub}</span>
    </div>
  );
}

function KpiTile({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta: ReactNode;
}) {
  return (
    <div className="rounded-card border border-[var(--border)] bg-surface px-4 py-3.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className="mt-1 text-[1.75rem] font-semibold leading-none tabular-nums tracking-tight">
        {value}
      </div>
      <div className="mt-2 text-[11px] leading-snug">{delta}</div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted">Loading dashboard…</div>}>
      <DashboardInner />
    </Suspense>
  );
}
