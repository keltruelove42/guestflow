"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { LogoMark } from "@/components/brand/logo";
import { DemoModal } from "./landing";

/* LeadCoda pricing page. Same dark-navy brand system as the landing page.
   Flat workspace pricing (not per seat) positioned under Apollo/GHL. */

const NAVY = {
  page: "#050b1e",
  panel: "#0a142e",
  card: "rgba(255,255,255,0.045)",
  border: "rgba(255,255,255,0.09)",
};

type Plan = {
  key: string;
  name: string;
  tagline: string;
  monthly: number | null; // null = custom
  annual: number | null;
  fromPrice?: string;
  cta: "trial" | "demo";
  ctaLabel: string;
  highlight?: boolean;
  features: string[];
};

const PLANS: Plan[] = [
  {
    key: "starter",
    name: "Starter",
    tagline: "For solo operators who never want to miss a lead again",
    monthly: 29,
    annual: 24,
    cta: "trial",
    ctaLabel: "Start free trial",
    features: [
      "1 user",
      "Up to 1,000 leads",
      "1,000 automated emails / month",
      "SMS through your own Twilio number",
      "Industry template sequences + full editor",
      "Pipeline CRM with lead timelines",
      "Reporting dashboard",
      "CSV / paste lead import",
      "Works on mobile",
    ],
  },
  {
    key: "growth",
    name: "Growth",
    tagline: "For teams that want the whole funnel on autopilot",
    monthly: 79,
    annual: 64,
    cta: "trial",
    ctaLabel: "Start free trial",
    highlight: true,
    features: [
      "5 users included",
      "Unlimited leads",
      "10,000 automated emails / month",
      "Ad campaigns with instant lead forms",
      "All integrations (Meta, Klaviyo, PMS tools & more)",
      "Custom message variables",
      "Auto-enroll triggers (abandoned, quote, rebook)",
      "Revenue attribution reporting",
      "Priority support",
    ],
  },
  {
    key: "enterprise",
    name: "Pro",
    tagline: "For multi-location groups and franchises",
    monthly: null,
    annual: null,
    fromPrice: "from $199/mo",
    cta: "demo",
    ctaLabel: "Book a demo",
    features: [
      "Unlimited users",
      "Multi-location workspaces",
      "Unlimited email volume",
      "SSO & role permissions",
      "Custom onboarding & data migration",
      "Dedicated success manager",
      "Uptime & support SLA",
      "API access",
      "Custom contracts & invoicing",
    ],
  },
];

const ADDONS = [
  {
    icon: "🤍",
    name: "White-Glove Setup",
    price: "$199",
    per: "one time",
    desc: "We do the whole setup for you: migrate your leads, connect your integrations, tailor every sequence to your business, and hand you a running system.",
    note: "Comparable services run $500 to $1,500 elsewhere.",
  },
  {
    icon: "🛠️",
    name: "Professional Services",
    price: "$89",
    per: "per hour",
    desc: "On-demand help from our team: sequence copywriting, custom reporting, integration work, or anything else you want built inside your workspace.",
    note: "No retainer, no minimum. Book an hour when you need one.",
  },
  {
    icon: "🧭",
    name: "Growth Consulting",
    price: "$299",
    per: "per month",
    desc: "A monthly strategy session with a funnel specialist: we review your numbers, tune your follow-ups and campaigns, and leave you a written action plan.",
    note: "Cancel anytime. Most agencies charge $1,000+ for the same.",
  },
  {
    icon: "📞",
    name: "Coda Concierge",
    price: "from $499",
    per: "per month",
    desc: "Your BDR for hire. When a hot lead comes in, our reps call them within minutes, qualify them, and book them straight onto your calendar. Up to 100 called leads a month.",
    note: "Outsourced SDR teams start around $2,500/mo. Concierge starts at $499.",
  },
];

const TESTIMONIALS = [
  {
    initials: "MK",
    name: "Mike",
    role: "Owner, plumbing & HVAC company",
    icon: "🔧",
    quote:
      "We used to lose estimates just by being slow. Now every inquiry gets a text in under a minute and we book jobs while competitors are still checking voicemail.",
  },
  {
    initials: "RB",
    name: "Riley",
    role: "Short-term rental manager, 14 properties",
    icon: "🏡",
    quote:
      "The abandoned-inquiry rescue alone pays for the whole year. Guests who bailed at checkout come back and book. I stopped doing follow-up by hand entirely.",
  },
  {
    initials: "BL",
    name: "Bella",
    role: "Salon owner",
    icon: "💅",
    quote:
      "My book stays full because the rebooking nudges go out on schedule without me thinking about it. Setup took one afternoon and the templates sounded like me.",
  },
];

const FAQ = [
  {
    q: "Is pricing per user?",
    a: "No. Starter and Growth are flat prices for your whole workspace. A 5-person team on a typical per-seat CRM runs $245 to $595 a month. Growth is $79 flat.",
  },
  {
    q: "What counts as a lead?",
    a: "Any contact in your CRM: captured from an ad, imported from a spreadsheet, synced from an integration, or added by hand. We never charge you for the same lead twice.",
  },
  {
    q: "Do I need my own Twilio account for texting?",
    a: "On Starter and Growth you connect your own Twilio number in about two minutes, so your texts come from your business number and you pay Twilio's at-cost rates (about a penny per text). Pro plans can include managed texting.",
  },
  {
    q: "Can I change plans or cancel anytime?",
    a: "Yes. Upgrades take effect immediately, downgrades at the next billing cycle, and you can cancel in one click. Your data stays exportable either way.",
  },
  {
    q: "What happens when my free trial ends?",
    a: "Your workspace and data stay intact. Automations pause until you pick a plan, and nothing is deleted. No credit card is required to start.",
  },
  {
    q: "Do you offer discounts?",
    a: "Annual billing saves about 20%. Founding customers who join during our launch window keep their price for life, even as list prices rise.",
  },
];

/** Feature comparison rows: [label, starter, growth, enterprise] */
const COMPARE: Array<{ section: string; rows: Array<[string, string, string, string]> }> = [
  {
    section: "CRM & leads",
    rows: [
      ["Leads", "1,000", "Unlimited", "Unlimited"],
      ["Users", "1", "5", "Unlimited"],
      ["Pipeline stages tailored to your industry", "✓", "✓", "✓"],
      ["Lead timelines, notes & consent tracking", "✓", "✓", "✓"],
      ["CSV / paste import with dedupe", "✓", "✓", "✓"],
    ],
  },
  {
    section: "Follow-up automation",
    rows: [
      ["Industry template sequences", "✓", "✓", "✓"],
      ["Full sequence editor (steps, timing, channels)", "✓", "✓", "✓"],
      ["Instant text-back on new inquiries", "✓", "✓", "✓"],
      ["Auto-enroll triggers (abandoned, quote, rebook)", "Basic", "All", "All"],
      ["Custom message variables", "3", "Unlimited", "Unlimited"],
      ["Automated emails / month", "1,000", "10,000", "Unlimited"],
    ],
  },
  {
    section: "Channels & campaigns",
    rows: [
      ["Email + SMS + call tasks", "✓", "✓", "✓"],
      ["Ad campaigns with instant lead forms", "1 active", "Unlimited", "Unlimited"],
      ["Integrations (Meta, Klaviyo, PMS & more)", "2", "All", "All + API"],
    ],
  },
  {
    section: "Reporting & support",
    rows: [
      ["Reporting dashboard", "✓", "✓", "✓"],
      ["Revenue attribution by campaign & sequence", "", "✓", "✓"],
      ["Support", "Email", "Priority", "Dedicated manager + SLA"],
      ["SSO & role permissions", "", "", "✓"],
      ["Multi-location workspaces", "", "", "✓"],
    ],
  },
];

function Check() {
  return <span className="text-sky-300">✓</span>;
}

export function PricingPage() {
  const [annual, setAnnual] = useState(true);
  const [demoOpen, setDemoOpen] = useState(false);
  const demoUrl = process.env.NEXT_PUBLIC_BOOK_DEMO_URL;

  const demoAction = (cls: string, label: string) =>
    demoUrl ? (
      <a href={demoUrl} target="_blank" rel="noreferrer" className={cls}>
        {label}
      </a>
    ) : (
      <button type="button" onClick={() => setDemoOpen(true)} className={cls}>
        {label}
      </button>
    );

  return (
    <div
      className="min-h-screen overflow-x-clip text-white antialiased"
      style={{ background: NAVY.page, fontFeatureSettings: '"ss01"' }}
    >
      {/* glow accents */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-blue-600/20 blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[480px] rounded-full bg-sky-500/10 blur-[120px]" />
      </div>

      {/* ===== Nav ===== */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark size={32} />
          <span className="text-lg font-bold tracking-tight">
            Lead<span className="text-sky-300">Coda</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
          <Link href="/#how" className="hover:text-white">
            How it works
          </Link>
          <Link href="/#industries" className="hover:text-white">
            Industries
          </Link>
          <Link href="/#features" className="hover:text-white">
            Features
          </Link>
          <span className="font-medium text-white">Pricing</span>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden text-sm text-slate-300 hover:text-white sm:block">
            Log in
          </Link>
          {demoAction(
            "hidden rounded-xl border border-white/20 px-4 py-2 text-sm font-medium hover:bg-white/5 sm:block",
            "Book a demo",
          )}
          <Link
            href="/signup"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500"
          >
            Start free trial
          </Link>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-6 pt-12 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
          ⚡ Flat pricing. Not per seat.
        </span>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
          Pricing that pays for itself with{" "}
          <span className="bg-gradient-to-r from-blue-400 to-sky-300 bg-clip-text text-transparent">
            one saved lead
          </span>
          .
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
          Every plan includes the CRM, automated follow-ups, and the reporting dashboard. Start
          free, no credit card, and keep your price for life as a founding customer.
        </p>

        {/* billing toggle */}
        <div className="mt-8 inline-flex items-center gap-1 rounded-full border p-1" style={{ borderColor: NAVY.border, background: NAVY.card }}>
          <button
            type="button"
            onClick={() => setAnnual(false)}
            className={`rounded-full px-4 py-1.5 text-sm ${!annual ? "bg-blue-600 font-semibold text-white" : "text-slate-300"}`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setAnnual(true)}
            className={`rounded-full px-4 py-1.5 text-sm ${annual ? "bg-blue-600 font-semibold text-white" : "text-slate-300"}`}
          >
            Annual <span className={annual ? "text-sky-200" : "text-sky-300"}>· save 20%</span>
          </button>
        </div>
      </section>

      {/* ===== Plan cards ===== */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-10">
        <div className="grid gap-5 lg:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.key}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                p.highlight ? "border-blue-400/60 shadow-2xl shadow-blue-600/20" : ""
              }`}
              style={{
                background: p.highlight ? NAVY.panel : NAVY.card,
                borderColor: p.highlight ? undefined : NAVY.border,
              }}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
                  Most popular
                </span>
              )}
              <h2 className="text-lg font-bold">{p.name}</h2>
              <p className="mt-1 min-h-[40px] text-sm text-slate-400">{p.tagline}</p>
              <div className="mt-4">
                {p.monthly != null ? (
                  <>
                    <span className="text-4xl font-extrabold tabular-nums">
                      ${annual ? p.annual : p.monthly}
                    </span>
                    <span className="text-slate-400"> /month</span>
                    <div className="mt-1 text-xs text-slate-500">
                      {annual ? "billed annually" : "billed monthly"} · whole workspace, not per
                      user
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-4xl font-extrabold">Custom</span>
                    <div className="mt-1 text-xs text-slate-500">{p.fromPrice} · annual contract</div>
                  </>
                )}
              </div>
              {p.cta === "trial" ? (
                <Link
                  href="/signup"
                  className={`mt-5 rounded-xl py-2.5 text-center text-sm font-semibold ${
                    p.highlight
                      ? "bg-blue-600 hover:bg-blue-500"
                      : "border border-white/20 hover:bg-white/5"
                  }`}
                >
                  {p.ctaLabel}
                </Link>
              ) : (
                demoAction(
                  "mt-5 rounded-xl border border-white/20 py-2.5 text-center text-sm font-semibold hover:bg-white/5",
                  p.ctaLabel,
                )
              )}
              <ul className="mt-6 space-y-2.5 text-sm text-slate-300">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          For context: a 5-person team on Apollo runs $245 to $595 a month, and GoHighLevel starts
          at $97. Growth is $79 flat for your whole team.
        </p>

        {/* trust bar */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-slate-400">
          <span>✓ 7-day free trial</span>
          <span>✓ No credit card to start</span>
          <span>✓ Cancel anytime</span>
          <span>✓ 30-day money-back guarantee on annual plans</span>
        </div>
      </section>

      {/* ===== Add-ons ===== */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-center text-3xl font-extrabold tracking-tight">
          Add-ons, when you want us in the trenches with you.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-400">
          Every add-on works with any plan. Priced to be a fraction of what agencies and
          outsourced teams charge.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {ADDONS.map((a) => (
            <div
              key={a.name}
              className="rounded-2xl border p-6"
              style={{ background: NAVY.card, borderColor: NAVY.border }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{a.icon}</span>
                  <h3 className="font-bold">{a.name}</h3>
                </div>
                <div className="text-right">
                  <div className="text-xl font-extrabold text-sky-300">{a.price}</div>
                  <div className="text-[11px] text-slate-500">{a.per}</div>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">{a.desc}</p>
              <p className="mt-2 text-xs text-slate-500">{a.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Social proof ===== */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-center text-3xl font-extrabold tracking-tight">
          Operators who stopped chasing and started closing.
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className="flex flex-col rounded-2xl border p-6"
              style={{ background: NAVY.card, borderColor: NAVY.border }}
            >
              <div className="text-sky-300">★★★★★</div>
              <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-slate-300">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-4 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600/30 text-xs font-bold text-sky-200">
                  {t.initials}
                </span>
                <div>
                  <div className="text-sm font-semibold">
                    {t.name} <span className="ml-1">{t.icon}</span>
                  </div>
                  <div className="text-xs text-slate-500">{t.role}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-center text-sm text-slate-400">
          <span>
            <b className="text-white">&lt; 60 sec</b> first response to new leads
          </span>
          <span>
            <b className="text-white">6 industries</b> with tailored workspaces
          </span>
          <span>
            <b className="text-white">5-7×</b> touches it takes to win a quiet lead
          </span>
        </div>
      </section>

      {/* ===== Comparison table ===== */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-center text-3xl font-extrabold tracking-tight">
          Compare plans in detail.
        </h2>
        <div
          className="mt-10 overflow-x-auto rounded-2xl border"
          style={{ background: NAVY.card, borderColor: NAVY.border }}
        >
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: NAVY.border }}>
                <th className="px-5 py-4 font-semibold text-slate-400">Features</th>
                <th className="px-5 py-4 font-bold">Starter</th>
                <th className="px-5 py-4 font-bold text-sky-300">Growth</th>
                <th className="px-5 py-4 font-bold">Pro</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((group) => (
                <Fragment key={group.section}>
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 pb-2 pt-5 text-xs font-semibold uppercase tracking-wider text-slate-500"
                    >
                      {group.section}
                    </td>
                  </tr>
                  {group.rows.map((row) => (
                    <tr
                      key={row[0]}
                      className="border-t"
                      style={{ borderColor: "rgba(255,255,255,0.05)" }}
                    >
                      <td className="px-5 py-3 text-slate-300">{row[0]}</td>
                      {[row[1], row[2], row[3]].map((cell, i) => (
                        <td key={i} className="px-5 py-3">
                          {cell === "✓" ? <Check /> : cell === "" ? (
                            <span className="text-slate-600">·</span>
                          ) : (
                            <span className="text-slate-200">{cell}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="relative z-10 mx-auto max-w-3xl px-5 py-14">
        <h2 className="text-center text-3xl font-extrabold tracking-tight">
          Questions, answered.
        </h2>
        <div className="mt-8 space-y-3">
          {FAQ.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border px-5 py-4"
              style={{ background: NAVY.card, borderColor: NAVY.border }}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="text-slate-500 transition-transform group-open:rotate-45">＋</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <section className="relative z-10 mx-auto max-w-4xl px-5 py-16 text-center">
        <div
          className="rounded-3xl border px-8 py-12"
          style={{ background: NAVY.panel, borderColor: NAVY.border }}
        >
          <h2 className="text-3xl font-extrabold tracking-tight">
            One saved lead covers the month. The rest is profit.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-300">
            Set up in 2 minutes, pre-loaded with demo data for your industry. No credit card.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-xl bg-blue-600 px-6 py-3.5 text-base font-semibold shadow-lg shadow-blue-600/30 hover:bg-blue-500"
            >
              Start free trial
            </Link>
            {demoAction(
              "rounded-xl border border-white/20 px-6 py-3.5 text-base font-medium hover:bg-white/5",
              "Book a demo",
            )}
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="relative z-10 border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-slate-500 md:flex-row">
          <div className="flex items-center gap-2">
            <LogoMark size={22} />
            <span className="font-semibold text-slate-300">LeadCoda</span>
            <span>· Follow-up that wins the booking.</span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <Link href="/#industries" className="hover:text-slate-300">
              Industries
            </Link>
            <Link href="/security" className="hover:text-slate-300">
              Security
            </Link>
            <Link href="/privacy" className="hover:text-slate-300">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-slate-300">
              Terms
            </Link>
            <Link href="/login" className="hover:text-slate-300">
              Log in
            </Link>
            <Link href="/signup" className="hover:text-slate-300">
              Free trial
            </Link>
          </div>
        </div>
      </footer>

      {demoOpen && <DemoModal onClose={() => setDemoOpen(false)} />}
    </div>
  );
}
