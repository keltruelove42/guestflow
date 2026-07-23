import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Growth Consulting · LeadCoda",
  description:
    "Hands-on growth consulting from operators: outbound and pipeline systems, revenue tool stacks, onboarding, and local lead generation. Built in LeadCoda or in the tools you already use.",
};

const NAVY = {
  page: "#050b1e",
  panel: "#0a142e",
  card: "rgba(255,255,255,0.045)",
  border: "rgba(255,255,255,0.09)",
};

const SERVICES = [
  {
    icon: "📈",
    title: "Outbound & pipeline systems",
    desc: "Channel strategy designed from scratch: who to target, how to reach them, and the sequences that actually get replies. The same playbooks that built eight figures of pipeline, sized for your business.",
  },
  {
    icon: "🧰",
    title: "Revenue tool stack build-outs",
    desc: "We work fluently across the modern stack: CRMs, engagement platforms like Outreach and Salesloft, data providers like Apollo and ZoomInfo, and AI-powered enrichment with Clay. We build in what you already pay for, or recommend what you should.",
  },
  {
    icon: "🚀",
    title: "Onboarding & adoption",
    desc: "Four-plus years running SaaS onboarding means we know why tools end up as shelfware. We set up your systems, train your team on them, and stay until they stick.",
  },
  {
    icon: "📍",
    title: "Local lead generation",
    desc: "For home services, automotive, hospitality, and retail: local channel strategy, review and referral engines, and follow-up systems built by someone who has run these businesses, not just advised them.",
  },
  {
    icon: "🤖",
    title: "AI-assisted growth workflows",
    desc: "Enrichment, personalization, and automation with AI where it genuinely helps and humans where it matters. Practical systems your team can run without a data science degree.",
  },
  {
    icon: "🗺️",
    title: "Fractional growth leadership",
    desc: "An experienced head of outreach in your corner without the full-time hire: strategy, hiring guidance, pipeline reviews, and accountability on a monthly cadence.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Discovery call",
    desc: "Thirty minutes, free. We learn how you get customers today and where leads leak.",
  },
  {
    n: "2",
    title: "Audit & plan",
    desc: "We map your funnel end to end and hand you a written plan with priorities and projected impact. The plan is yours to keep either way.",
  },
  {
    n: "3",
    title: "Build",
    desc: "We build the systems: channels, sequences, data, tooling, and reporting. In LeadCoda or in your existing stack.",
  },
  {
    n: "4",
    title: "Run or hand off",
    desc: "We train your team and hand over the keys, or stay on retainer and keep tuning. Your call.",
  },
];

export default function ConsultingPage() {
  const bookHref =
    process.env.NEXT_PUBLIC_BOOK_DEMO_URL ??
    "mailto:hello@leadcoda.app?subject=Consulting%20discovery%20call";

  return (
    <div
      className="min-h-screen overflow-x-clip text-white antialiased"
      style={{ background: NAVY.page }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-blue-600/20 blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[360px] w-[480px] rounded-full bg-sky-500/10 blur-[120px]" />
      </div>

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark size={32} />
          <span className="text-lg font-bold tracking-tight">
            Lead<span className="text-sky-300">Coda</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
          <Link href="/#features" className="hover:text-white">
            Product
          </Link>
          <Link href="/pricing" className="hover:text-white">
            Pricing
          </Link>
          <span className="font-medium text-white">Consulting</span>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden text-sm text-slate-300 hover:text-white sm:block">
            Log in
          </Link>
          <a
            href={bookHref}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500"
          >
            Book a discovery call
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-4xl px-5 pb-8 pt-14 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
          🧭 LeadCoda Consulting
        </span>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
          Growth systems built by{" "}
          <span className="bg-gradient-to-r from-blue-400 to-sky-300 bg-clip-text text-transparent">
            operators
          </span>
          , not theorists.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
          We design and build the outbound channels, follow-up systems, and revenue tooling
          that grow small and mid-sized businesses. Built in LeadCoda if it fits, or in the
          tools you already use. We are not attached to selling you software. We are
          attached to growing your pipeline.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href={bookHref}
            className="rounded-xl bg-blue-600 px-6 py-3.5 text-base font-semibold shadow-lg shadow-blue-600/30 hover:bg-blue-500"
          >
            Book a free discovery call
          </a>
          <Link
            href="/pricing"
            className="rounded-xl border border-white/20 px-6 py-3.5 text-base font-medium hover:bg-white/5"
          >
            See the product
          </Link>
        </div>
      </section>

      {/* Stat strip */}
      <section className="relative z-10 mx-auto max-w-5xl px-5 py-10">
        <div
          className="grid gap-6 rounded-2xl border px-6 py-8 text-center sm:grid-cols-3"
          style={{ background: NAVY.card, borderColor: NAVY.border }}
        >
          <div>
            <div className="text-3xl font-extrabold">$5M+</div>
            <div className="mt-1 text-sm text-slate-400">
              in new pipeline built last year alone, through channels designed from zero
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold">40+ years</div>
            <div className="mt-1 text-sm text-slate-400">
              combined operating experience across SaaS, services, automotive, and retail
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold">Your stack or ours</div>
            <div className="mt-1 text-sm text-slate-400">
              fluent in the CRMs, engagement platforms, and data tools you already use
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-12">
        <h2 className="text-center text-3xl font-extrabold tracking-tight">
          What we build with you.
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <div
              key={s.title}
              className="rounded-2xl border p-5"
              style={{ background: NAVY.card, borderColor: NAVY.border }}
            >
              <div className="text-2xl">{s.icon}</div>
              <h3 className="mt-3 font-bold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Who you work with */}
      <section className="relative z-10 mx-auto max-w-5xl px-5 py-12">
        <h2 className="text-center text-3xl font-extrabold tracking-tight">
          Who you are working with.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-400">
          Two operators with more than twenty years in business each. Between us we have
          sold, serviced, onboarded, and grown at every layer of the funnel.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div
            className="rounded-2xl border p-7"
            style={{ background: NAVY.panel, borderColor: NAVY.border }}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600/30 text-lg font-bold text-sky-200">
              KJ
            </div>
            <h3 className="mt-4 text-lg font-bold">Kelli</h3>
            <div className="text-sm text-sky-300">Co-Founder · Revenue Systems & Outbound</div>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Kelli leads outreach at a B2B SaaS company, where the channels she designed
              and built from scratch generated more than five million dollars in new
              pipeline in the last year alone. She has spent over four years inside SaaS
              onboarding and growth, which means she has personally set up, run, and fixed
              nearly every major CRM and sales engagement platform on the market, and
              builds modern AI-assisted prospecting systems with tools like Clay layered
              over data providers such as Apollo, ZoomInfo, Outreach, and Salesloft. She
              brings enterprise-grade outbound discipline to businesses that could never
              justify an enterprise team.
            </p>
          </div>
          <div
            className="rounded-2xl border p-7"
            style={{ background: NAVY.panel, borderColor: NAVY.border }}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600/30 text-lg font-bold text-sky-200">
              TJ
            </div>
            <h3 className="mt-4 text-lg font-bold">Taylor</h3>
            <div className="text-sm text-sky-300">Co-Founder · Operations & Local Growth</div>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Taylor has built and grown businesses on the ground for more than two
              decades: years in the automotive business, a home services restoration
              company in Atlanta that he scaled from a phone and a truck into a thriving
              operation, a watersports business in St. Croix, and a retail venture built
              and run alongside Kelli. He knows what a missed call costs a local business
              because he has lived it, and every system we build is tested against one
              question: would this actually work at the counter, on the lot, or in the
              truck?
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 mx-auto max-w-5xl px-5 py-12">
        <h2 className="text-center text-3xl font-extrabold tracking-tight">
          How an engagement works.
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border p-5"
              style={{ background: NAVY.card, borderColor: NAVY.border }}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-sky-400 text-sm font-bold">
                {s.n}
              </div>
              <h3 className="mt-3 font-bold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{s.desc}</p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-slate-500">
          Looking for done-for-you lead calling instead of a full engagement? That is{" "}
          <Link href="/pricing" className="text-sky-300 hover:underline">
            Coda Concierge
          </Link>
          , our BDR-for-hire add-on. Consulting goes deeper: we build the whole machine.
        </p>
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto max-w-4xl px-5 py-16 text-center">
        <div
          className="rounded-3xl border px-8 py-12"
          style={{ background: NAVY.panel, borderColor: NAVY.border }}
        >
          <h2 className="text-3xl font-extrabold tracking-tight">
            Tell us how you get customers. We will show you what is leaking.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-300">
            The discovery call is free, the audit plan is yours to keep, and there is no
            obligation to use our software or anything else.
          </p>
          <div className="mt-7">
            <a
              href={bookHref}
              className="rounded-xl bg-blue-600 px-6 py-3.5 text-base font-semibold shadow-lg shadow-blue-600/30 hover:bg-blue-500"
            >
              Book a free discovery call
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-slate-500 md:flex-row">
          <div className="flex items-center gap-2">
            <LogoMark size={22} />
            <span className="font-semibold text-slate-300">LeadCoda</span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <Link href="/pricing" className="hover:text-slate-300">Pricing</Link>
            <Link href="/security" className="hover:text-slate-300">Security</Link>
            <Link href="/privacy" className="hover:text-slate-300">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-300">Terms</Link>
            <Link href="/signup" className="hover:text-slate-300">Free trial</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
