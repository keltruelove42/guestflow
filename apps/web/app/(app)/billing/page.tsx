"use client";

import { Suspense, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

const PLANS = [
  {
    key: "STARTER",
    name: "Starter",
    monthly: 29,
    annual: 24,
    blurb: "For solo operators",
    features: ["1 user", "Up to 1,000 leads", "1,000 automated emails / month"],
    highlight: false,
  },
  {
    key: "GROWTH",
    name: "Growth",
    monthly: 79,
    annual: 64,
    blurb: "Most popular, for teams",
    features: [
      "5 users",
      "Unlimited leads",
      "10,000 automated emails / month",
      "Ad campaigns + all integrations",
    ],
    highlight: true,
  },
] as const;

export default function BillingPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <BillingInner />
    </Suspense>
  );
}

function BillingInner() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const [annual, setAnnual] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { data: billing } = useQuery({
    queryKey: ["billing"],
    queryFn: async () => {
      const res = await fetch("/api/v1/billing");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{
        plan: string;
        hasSubscription: boolean;
        configured: boolean;
      }>;
    },
  });

  const checkout = useMutation({
    mutationFn: async ({ plan }: { plan: string }) => {
      const res = await fetch("/api/v1/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval: annual ? "annual" : "monthly" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start checkout");
      return data as { url: string };
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Failed"),
  });

  const portal = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not open portal");
      return data as { url: string };
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Failed"),
  });

  const plan = billing?.plan ?? "TRIAL";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {status === "success" && (
        <div className="rounded-card border border-[var(--border)] bg-[color-mix(in_srgb,var(--good)_12%,transparent)] p-4 text-sm">
          🎉 You are all set. Your plan is active, and a receipt is on its way to your
          inbox.
        </div>
      )}
      {status === "cancelled" && (
        <div className="rounded-card border border-[var(--border)] bg-surface p-4 text-sm text-ink-2">
          Checkout cancelled. No charge was made.
        </div>
      )}

      <div className="rounded-card border border-[var(--border)] bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Current plan</h2>
            <p className="mt-1 text-2xl font-extrabold">
              {plan === "TRIAL" ? "Free trial" : plan.charAt(0) + plan.slice(1).toLowerCase()}
            </p>
            <p className="mt-1 text-xs text-muted">
              {plan === "TRIAL"
                ? "Full access. Pick a plan to keep automations running after your trial."
                : "Thanks for being a founding customer. Your price is locked for life."}
            </p>
          </div>
          {billing?.hasSubscription && (
            <button
              type="button"
              className="rounded-control border border-[var(--border)] px-3 py-2 text-sm"
              disabled={portal.isPending}
              onClick={() => portal.mutate()}
            >
              {portal.isPending ? "Opening…" : "Manage billing"}
            </button>
          )}
        </div>
      </div>

      {billing && !billing.configured && (
        <p className="rounded-card border border-[var(--border)] bg-surface-2 p-4 text-xs text-ink-2">
          Online checkout is not switched on yet. It goes live once Stripe keys are
          configured.
        </p>
      )}

      <div className="flex items-center gap-2">
        <span className="text-xs text-ink-2">Billing</span>
        <div className="inline-flex items-center gap-1 rounded-pill border border-[var(--border)] bg-surface p-1">
          <button
            type="button"
            onClick={() => setAnnual(false)}
            className={`rounded-pill px-3 py-1 text-xs ${!annual ? "bg-accent font-semibold text-white" : "text-ink-2"}`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setAnnual(true)}
            className={`rounded-pill px-3 py-1 text-xs ${annual ? "bg-accent font-semibold text-white" : "text-ink-2"}`}
          >
            Annual · save 20%
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {PLANS.map((p) => (
          <div
            key={p.key}
            className={`rounded-card border bg-surface p-5 ${
              p.highlight ? "border-accent" : "border-[var(--border)]"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <h3 className="font-bold">{p.name}</h3>
              <div>
                <span className="text-2xl font-extrabold tabular-nums">
                  ${annual ? p.annual : p.monthly}
                </span>
                <span className="text-xs text-muted">/mo</span>
              </div>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {p.blurb} · {annual ? "billed annually" : "billed monthly"}
            </p>
            <ul className="mt-3 space-y-1.5 text-xs text-ink-2">
              {p.features.map((f) => (
                <li key={f}>✓ {f}</li>
              ))}
            </ul>
            <button
              type="button"
              disabled={checkout.isPending || plan === p.key || !billing?.configured}
              className={`mt-4 w-full rounded-control py-2 text-sm font-medium disabled:opacity-60 ${
                p.highlight
                  ? "bg-accent text-white"
                  : "border border-[var(--border)]"
              }`}
              onClick={() => checkout.mutate({ plan: p.key })}
            >
              {plan === p.key
                ? "Current plan"
                : checkout.isPending
                  ? "Redirecting…"
                  : `Upgrade to ${p.name}`}
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-card border border-[var(--border)] bg-surface p-5">
        <h2 className="text-sm font-semibold">Add-ons</h2>
        <p className="mt-1 text-xs text-muted">
          Humans from our team, on your side. Works with any plan.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            {
              icon: "📞",
              name: "Coda Concierge",
              sub: "Your BDR for hire",
              price: "from $499/mo",
              desc: "Our reps call your hot leads within minutes, qualify them, and book them straight onto your calendar.",
              featured: true,
            },
            {
              icon: "🤍",
              name: "White-Glove Setup",
              sub: "We build your workspace",
              price: "$199 one time",
              desc: "Lead migration, integrations connected, sequences tailored to your business.",
            },
            {
              icon: "🧭",
              name: "Growth Consulting",
              sub: "Monthly strategy session",
              price: "$299/mo",
              desc: "Funnel review, follow-up tuning, and a written action plan every month.",
            },
            {
              icon: "🛠️",
              name: "Professional Services",
              sub: "On-demand expert hours",
              price: "$89/hr",
              desc: "Copywriting, custom reporting, integration work. No retainer.",
            },
          ].map((a) => (
            <div
              key={a.name}
              className={`rounded-control border p-3.5 ${
                a.featured ? "border-accent" : "border-[var(--border)]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">
                    {a.icon} {a.name}
                  </div>
                  <div className="text-[11px] text-muted">{a.sub}</div>
                </div>
                <span className="shrink-0 text-xs font-bold text-accent">{a.price}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-2">{a.desc}</p>
              <a
                href={`mailto:hello@leadcoda.app?subject=${encodeURIComponent(`Add-on: ${a.name}`)}`}
                className={`mt-2.5 inline-block rounded-control px-3 py-1.5 text-xs font-medium ${
                  a.featured
                    ? "bg-gradient-to-r from-[#2563eb] to-[#38bdf8] text-white"
                    : "border border-[var(--border)]"
                }`}
              >
                {a.featured ? "⚡ Get Concierge" : "Add"}
              </a>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted">
        Payments are processed by Stripe. Card details never touch LeadCoda servers. Need
        Enterprise?{" "}
        <a href="mailto:legal@leadcoda.com" className="text-accent">
          Talk to us
        </a>
        .
      </p>

      {error && <p className="text-sm text-critical">{error}</p>}
    </div>
  );
}
