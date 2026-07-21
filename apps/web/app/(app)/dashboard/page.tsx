"use client";

import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useOnboardingOptional } from "@/components/onboarding/onboarding-provider";
import { ONBOARDING_STEPS } from "@/lib/onboarding";

function DashboardInner() {
  const searchParams = useSearchParams();
  const property = searchParams.get("property");
  const onboarding = useOnboardingOptional();

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", property],
    queryFn: async () => {
      const qs = property ? `property=${property}` : "";
      const res = await fetch(`/api/v1/leads${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to load leads");
      return res.json() as Promise<
        Array<{
          id: string;
          name: string;
          stage: string;
          source: string;
          needsAttention: boolean;
          property?: { name: string } | null;
        }>
      >;
    },
  });

  const attention = leads.filter((l) => l.needsAttention);
  const newCount = leads.filter((l) => l.stage === "NEW").length;
  const booked = leads.filter((l) => l.stage === "BOOKED").length;

  const nextStep = onboarding
    ? ONBOARDING_STEPS.find((s) => !onboarding.isDone(s.id))
    : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "New leads (loaded)", value: String(leads.length) },
          { label: "In NEW stage", value: String(newCount) },
          { label: "Needs attention", value: String(attention.length) },
          { label: "Booked", value: String(booked) },
        ].map((t) => (
          <div
            key={t.label}
            className="rounded-card border border-[var(--border)] bg-surface p-4"
          >
            <div className="text-xs text-muted">{t.label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{t.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-card border border-[var(--border)] bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold">Needs your attention</h2>
          {isLoading && <p className="text-sm text-muted">Loading…</p>}
          {!isLoading && attention.length === 0 && (
            <p className="text-sm text-muted">Nothing waiting — you&apos;re clear.</p>
          )}
          <ul className="space-y-2">
            {attention.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/leads?open=${l.id}`}
                  className="flex items-center justify-between rounded-control bg-surface-2 px-3 py-2 text-sm hover:bg-grid"
                >
                  <span className="font-medium">{l.name}</span>
                  <span className="text-xs text-muted">
                    {l.property?.name ?? "—"} · automation paused
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-card border border-[var(--border)] bg-surface p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Getting started</h2>
            {onboarding?.ready && (
              <span className="text-[11px] tabular-nums text-muted">
                {onboarding.stats.done}/{onboarding.stats.total} · {onboarding.stats.earned} XP
              </span>
            )}
          </div>

          {onboarding?.ready && onboarding.stats.pct >= 100 ? (
            <p className="text-sm leading-relaxed text-ink-2">
              You&apos;ve hit the activation milestones. Keep launching campaigns and following up
              from Leads.
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-ink-2">
              {nextStep
                ? `Next up: ${nextStep.title}. ${nextStep.description}`
                : "Use the checklist to walk through your first wins — ads, follow-ups, and messaging."}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {nextStep && (
              <Link
                href={nextStep.href}
                className="rounded-control bg-accent px-3 py-1.5 text-sm font-medium text-white"
              >
                {nextStep.title}
              </Link>
            )}
            {onboarding?.local.checklistDismissed ? (
              <button
                type="button"
                className="rounded-control border border-[var(--border)] px-3 py-1.5 text-sm"
                onClick={() => onboarding.reopenChecklist()}
              >
                Reopen checklist
              </button>
            ) : (
              <button
                type="button"
                className="rounded-control border border-[var(--border)] px-3 py-1.5 text-sm"
                onClick={() => onboarding?.startTour()}
              >
                Show tips
              </button>
            )}
            <Link
              href="/leads"
              className="rounded-control border border-[var(--border)] px-3 py-1.5 text-sm"
            >
              Browse leads
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted">Loading…</div>}>
      <DashboardInner />
    </Suspense>
  );
}
