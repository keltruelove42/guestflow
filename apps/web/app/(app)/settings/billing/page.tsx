"use client";

import { Suspense, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  const [conciergeOpen, setConciergeOpen] = useState(false);
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

      <TeamCard />

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
              {a.featured ? (
                <button
                  type="button"
                  className="mt-2.5 inline-block rounded-control bg-gradient-to-r from-[#2563eb] to-[#38bdf8] px-3 py-1.5 text-xs font-medium text-white"
                  onClick={() => setConciergeOpen(true)}
                >
                  ⚡ Get Concierge
                </button>
              ) : (
                <a
                  href={`mailto:hello@leadcoda.app?subject=${encodeURIComponent(`Add-on: ${a.name}`)}`}
                  className="mt-2.5 inline-block rounded-control border border-[var(--border)] px-3 py-1.5 text-xs font-medium"
                >
                  Add
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted">
        Payments are processed by Stripe. Card details never touch LeadCoda servers. Need
        Enterprise?{" "}
        <a href="mailto:legal@leadcoda.app" className="text-accent">
          Talk to us
        </a>
        .
      </p>

      {error && <p className="text-sm text-critical">{error}</p>}

      {conciergeOpen && <ConciergeModal onClose={() => setConciergeOpen(false)} />}
    </div>
  );
}

function TeamCard() {
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const queryKey = ["org-team"];
  const qcLocal = useQueryClient();

  const { data } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch("/api/v1/org/invites");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{
        users: Array<{ id: string; name: string | null; email: string }>;
        invites: Array<{ id: string; email: string; token: string }>;
      }>;
    },
  });

  const invite = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/v1/org/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Invite failed");
      return d as { link: string };
    },
    onSuccess: (d) => {
      setEmail("");
      setInviteLink(d.link);
      setFeedback("Invite created. Send them the link below if the email does not arrive.");
      qcLocal.invalidateQueries({ queryKey });
    },
    onError: (e) => {
      setInviteLink(null);
      setFeedback(e instanceof Error ? e.message : "Invite failed");
    },
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/v1/org/invites?id=${id}`, { method: "DELETE" });
    },
    onSuccess: () => qcLocal.invalidateQueries({ queryKey }),
  });

  return (
    <div className="rounded-card border border-[var(--border)] bg-surface p-5">
      <h2 className="text-sm font-semibold">Team</h2>
      <p className="mt-1 text-xs text-muted">
        Teammates share this workspace: same leads, sequences, and calendar.
      </p>

      <div className="mt-3 space-y-1.5">
        {(data?.users ?? []).map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between rounded-control bg-surface-2 px-3 py-2 text-sm"
          >
            <span>
              {u.name ?? u.email}
              <span className="ml-2 text-xs text-muted">{u.email}</span>
            </span>
          </div>
        ))}
        {(data?.invites ?? []).map((i) => (
          <div
            key={i.id}
            className="flex items-center justify-between rounded-control border border-dashed border-[var(--border)] px-3 py-2 text-sm"
          >
            <span className="text-ink-2">
              {i.email}
              <span className="ml-2 rounded-pill bg-surface-2 px-1.5 text-[10px] text-muted">
                invited
              </span>
            </span>
            <button
              type="button"
              className="text-xs text-critical"
              onClick={() => revoke.mutate(i.id)}
            >
              Revoke
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          type="email"
          placeholder="teammate@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={invite.isPending || !email.trim()}
          className="shrink-0 rounded-control bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          onClick={() => invite.mutate()}
        >
          {invite.isPending ? "Inviting…" : "Invite"}
        </button>
      </div>
      {feedback && <p className="mt-2 text-xs text-ink-2">{feedback}</p>}
      {inviteLink && (
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          <code className="truncate rounded bg-surface-2 px-2 py-1">{inviteLink}</code>
          <button
            type="button"
            className="shrink-0 text-accent"
            onClick={() => navigator.clipboard.writeText(inviteLink)}
          >
            Copy
          </button>
        </div>
      )}
    </div>
  );
}

function ConciergeModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-card border border-[var(--border)] bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h3 className="font-semibold">📞 Coda Concierge</h3>
          <button type="button" className="text-sm text-muted" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="space-y-4 p-5">
          <p className="text-sm leading-relaxed text-ink-2">
            Your BDR for hire. Speed wins deals, and most owners cannot drop everything to
            call a lead back in five minutes. Our reps can. Here is exactly how it works:
          </p>
          <ol className="space-y-3">
            {[
              [
                "1",
                "A hot lead comes in",
                "A new inquiry, a reply, or a lead your heat score flags as ready.",
              ],
              [
                "2",
                "We call within minutes",
                "A trained LeadCoda rep calls on your behalf, using your business name and the lead's full context from the CRM.",
              ],
              [
                "3",
                "We qualify and book",
                "The rep answers basic questions, qualifies the lead, and books them straight into an open slot on your LeadCoda calendar.",
              ],
              [
                "4",
                "You show up and close",
                "Call notes land on the lead's timeline. You walk into every appointment knowing exactly what they want.",
              ],
            ].map(([n, title, desc]) => (
              <li key={n} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                  {n}
                </span>
                <div>
                  <div className="text-sm font-semibold">{title}</div>
                  <p className="text-xs leading-relaxed text-ink-2">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="rounded-control bg-surface-2 p-3 text-xs text-ink-2">
            <b className="text-ink">Pricing:</b> from $499/mo for up to 100 called leads.
            Outsourced SDR teams typically start around $2,500/mo. Cancel monthly, no
            contract.
          </div>
          <a
            href={`mailto:hello@leadcoda.app?subject=${encodeURIComponent("Coda Concierge: I want in")}&body=${encodeURIComponent("Tell us a bit about your business and lead volume, and we will reach out within one business day to get Concierge running for you.")}`}
            className="block rounded-control bg-gradient-to-r from-[#2563eb] to-[#38bdf8] py-2.5 text-center text-sm font-semibold text-white"
          >
            ⚡ Request Concierge
          </a>
          <p className="text-center text-[11px] text-muted">
            We reach out within one business day to set everything up.
          </p>
        </div>
      </div>
    </div>
  );
}
