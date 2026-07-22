"use client";

import Link from "next/link";
import { useState } from "react";
import { LogoMark } from "@/components/brand/logo";

/* LeadCoda marketing site, dark navy (userpilot-style depth, hubspot-style
   simplicity). Self-contained: no app-theme CSS vars. */

const NAVY = {
  page: "#050b1e",
  panel: "#0a142e",
  card: "rgba(255,255,255,0.045)",
  border: "rgba(255,255,255,0.09)",
};

const INDUSTRIES = [
  {
    icon: "🏡",
    name: "Vacation & long-term rentals",
    blurb: "Rescue abandoned booking inquiries and fill your calendar.",
    live: true,
  },
  {
    icon: "🔧",
    name: "Home services & trades",
    blurb: "Text back every missed call and win the estimate.",
    live: true,
  },
  {
    icon: "💅",
    name: "Salon & beauty",
    blurb: "Keep your book full with automatic rebooking nudges.",
    live: true,
  },
  {
    icon: "🏠",
    name: "Real estate",
    blurb: "Follow up on every listing inquiry before the other agent does.",
    live: true,
  },
  {
    icon: "🚗",
    name: "Auto & marine dealers",
    blurb: "Turn test-drive requests into signed deals.",
    live: true,
  },
  {
    icon: "🏨",
    name: "Hotels & B&Bs",
    blurb: "Convert direct-booking inquiries into stays.",
    live: true,
  },
];

const FEATURES = [
  {
    icon: "🗂️",
    title: "A real CRM underneath",
    desc: "Every lead gets a pipeline stage, full timeline, notes, and consent tracking. Your whole book of business in one place, with a live dashboard of how it's performing.",
  },
  {
    icon: "⚡",
    title: "Instant text-back",
    desc: "New inquiry? A friendly SMS goes out in under a minute, while your competitor is still checking voicemail.",
  },
  {
    icon: "🔁",
    title: "Follow-up sequences",
    desc: "Proven email + SMS templates for your industry, pre-loaded. Edit anything, or write your own.",
  },
  {
    icon: "🙋",
    title: "Human handoff",
    desc: "The moment a lead replies, automation pauses and the conversation is flagged for you. No robot awkwardness.",
  },
  {
    icon: "📣",
    title: "Lead ads, connected",
    desc: "Meta, TikTok and Pinterest instant forms drop straight into your pipeline and start their own follow-up.",
  },
  {
    icon: "📥",
    title: "Bring your past leads",
    desc: "Import a spreadsheet or sync Klaviyo, and put old inquiries into revival sequences with consent built in.",
  },
  {
    icon: "📊",
    title: "A reporting dashboard, built in",
    desc: "New leads per week, cost per lead, reply rates, lead sources, and won revenue attributed to the exact campaign and sequence that earned it.",
  },
  {
    icon: "🧠",
    title: "Knows your business",
    desc: "Teach it your services, pricing, and policies once. Follow-ups and replies pull the right details automatically.",
  },
  {
    icon: "📱",
    title: "Runs from your pocket",
    desc: "Reply to leads and check follow-ups from your phone. The heavy setup stays comfortable on desktop.",
  },
];

export function DemoModal({ onClose }: { onClose: () => void }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", company: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await fetch("/api/v1/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } catch {
      /* best effort */
    }
    setSent(true);
    setBusy(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        className="w-full max-w-md rounded-2xl border p-6 shadow-2xl"
        style={{ background: NAVY.panel, borderColor: NAVY.border }}
        onClick={(e) => e.stopPropagation()}
      >
        {sent ? (
          <div className="text-center">
            <div className="text-3xl">🎉</div>
            <h3 className="mt-3 text-lg font-semibold text-white">You&apos;re on the list</h3>
            <p className="mt-2 text-sm text-slate-300">
              We&apos;ll reach out within one business day to schedule your walkthrough.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-white">Book a demo</h3>
            <p className="mt-1 text-sm text-slate-400">
              20 minutes, tailored to your industry. We&apos;ll show you exactly where leads are
              slipping away.
            </p>
            <form onSubmit={submit} className="mt-4 space-y-3">
              {(
                [
                  ["name", "Your name", "text", true],
                  ["email", "Work email", "email", true],
                  ["company", "Business name (optional)", "text", false],
                ] as const
              ).map(([key, label, type, required]) => (
                <input
                  key={key}
                  type={type}
                  required={required}
                  placeholder={label}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full rounded-xl border bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
                  style={{ borderColor: NAVY.border }}
                />
              ))}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {busy ? "Sending…" : "Request my demo"}
              </button>
              <p className="text-center text-[11px] text-slate-500">
                Prefer to poke around first?{" "}
                <Link href="/signup" className="text-blue-400 hover:underline">
                  Start the free trial
                </Link>{" "}
                no credit card needed.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/** CSS-built product mock for the hero, no images needed. */
function HeroMock() {
  return (
    <div
      className="relative mx-auto w-full max-w-md rounded-2xl border p-4 shadow-2xl"
      style={{ background: NAVY.panel, borderColor: NAVY.border }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Needs your reply
        </span>
        <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-300">
          automation paused
        </span>
      </div>
      {[
        ["Jess A.", "“Can you hold Saturday for me?”", "💬", "2m"],
        ["Mike T.", "“What would a tankless swap run?”", "🔧", "11m"],
        ["Dana O.", "“Anything Friday after 3?”", "💅", "24m"],
      ].map(([n, m, e, t]) => (
        <div
          key={n}
          className="mt-3 flex items-center gap-3 rounded-xl border p-3"
          style={{ background: NAVY.card, borderColor: NAVY.border }}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-base">
            {e}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white">{n}</div>
            <div className="truncate text-xs text-slate-400">{m}</div>
          </div>
          <span className="text-[10px] text-slate-500">{t}</span>
          <span className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white">
            Reply
          </span>
        </div>
      ))}
      <div
        className="mt-3 flex items-center justify-between rounded-xl border p-3"
        style={{ background: NAVY.card, borderColor: NAVY.border }}
      >
        <div className="text-xs text-slate-400">
          <span className="font-semibold text-emerald-400">✓ 14 follow-ups</span> sent for you
          today
        </div>
        <div className="text-xs font-semibold text-white">$2,240 won</div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const [demoOpen, setDemoOpen] = useState(false);
  const demoUrl = process.env.NEXT_PUBLIC_BOOK_DEMO_URL;

  const demoButton = (cls: string, label = "Book a demo") =>
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
        <div className="flex items-center gap-2">
          <LogoMark size={32} />
          <span className="text-lg font-bold tracking-tight">
            Lead<span className="text-sky-300">Coda</span>
          </span>
        </div>
        <nav className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
          <a href="#how" className="hover:text-white">
            How it works
          </a>
          <a href="#industries" className="hover:text-white">
            Industries
          </a>
          <a href="#features" className="hover:text-white">
            Features
          </a>
          <Link href="/pricing" className="hover:text-white">
            Pricing
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden text-sm text-slate-300 hover:text-white sm:block">
            Log in
          </Link>
          {demoButton(
            "hidden rounded-xl border border-white/20 px-4 py-2 text-sm font-medium hover:bg-white/5 sm:block",
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
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-20 pt-14 md:pt-20">
        <div className="grid items-center gap-12 md:grid-cols-2 [&>*]:min-w-0">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
              ⚡ LeadCoda brings every lead to its close
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight md:text-[3.4rem]">
              Never lose another lead to{" "}
              <span className="bg-gradient-to-r from-blue-400 to-sky-300 bg-clip-text text-transparent">
                slow follow-up
              </span>
              .
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-300">
              LeadCoda captures every inquiry, follows up automatically, and hands you the
              conversation the moment a human should take over. You close, it chases.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="rounded-xl bg-blue-600 px-6 py-3.5 text-base font-semibold shadow-lg shadow-blue-600/30 hover:bg-blue-500"
              >
                Start free trial
              </Link>
              {demoButton(
                "rounded-xl border border-white/20 px-6 py-3.5 text-base font-medium hover:bg-white/5",
              )}
            </div>
            <p className="mt-3 text-sm text-slate-500">
              Free trial · No credit card needed · Set up in 2 minutes
            </p>
          </div>
          <HeroMock />
        </div>

        {/* stat strip */}
        <div
          className="mt-16 grid grid-cols-2 gap-4 rounded-2xl border p-6 md:grid-cols-4"
          style={{ background: NAVY.card, borderColor: NAVY.border }}
        >
          {[
            ["< 60 sec", "first response to new leads"],
            ["78%", "of buyers choose the business that answers first"],
            ["5–7×", "touches it takes to win a quiet lead"],
            ["$0", "credit card needed to start"],
          ].map(([big, small]) => (
            <div key={small} className="text-center">
              <div className="text-2xl font-extrabold text-white md:text-3xl">{big}</div>
              <div className="mt-1 text-xs leading-snug text-slate-400">{small}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section id="how" className="relative z-10 mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-center text-3xl font-extrabold tracking-tight md:text-4xl">
          Three steps. Zero leads dropped.
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            [
              "1",
              "Capture everything",
              "Lead ads, your website, missed calls, spreadsheets of past inquiries. Every lead lands in one pipeline, automatically.",
            ],
            [
              "2",
              "Follow up on autopilot",
              "Industry-proven text + email sequences start instantly and keep gently chasing until someone answers.",
            ],
            [
              "3",
              "Step in and win",
              "A reply pauses the robots and pings you. You take the warm conversation and book the job, stay, or appointment.",
            ],
          ].map(([n, t, d]) => (
            <div
              key={n}
              className="rounded-2xl border p-6"
              style={{ background: NAVY.card, borderColor: NAVY.border }}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-sky-400 text-sm font-bold">
                {n}
              </span>
              <h3 className="mt-4 text-lg font-bold">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Industries ===== */}
      <section id="industries" className="relative z-10 mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-center text-3xl font-extrabold tracking-tight md:text-4xl">
          Made for your industry, not adapted to it.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-400">
          Pick your industry and LeadCoda arrives speaking your language: your pipeline stages,
          your follow-up templates, your metrics.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {INDUSTRIES.map((ind) => (
            <div
              key={ind.name}
              className="group rounded-2xl border p-5 transition-colors hover:border-blue-400/40"
              style={{ background: NAVY.card, borderColor: NAVY.border }}
            >
              <div className="flex items-start justify-between">
                <span className="text-2xl">{ind.icon}</span>
              </div>
              <h3 className="mt-3 font-bold">{ind.name}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{ind.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Features ===== */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-center text-3xl font-extrabold tracking-tight md:text-4xl">
          A full CRM, with follow-up superpowers.
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border p-5"
              style={{ background: NAVY.card, borderColor: NAVY.border }}
            >
              <span className="text-xl">{f.icon}</span>
              <h3 className="mt-3 font-bold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <section className="relative z-10 mx-auto max-w-4xl px-5 py-20 text-center">
        <div
          className="rounded-3xl border p-10 md:p-14"
          style={{
            background:
              "linear-gradient(135deg, rgba(37,99,235,0.25), rgba(56,189,248,0.08))",
            borderColor: "rgba(96,165,250,0.25)",
          }}
        >
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            Your next customer is waiting on a reply.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-300">
            Start your free trial, pick your industry, and watch LeadCoda chase your first lead
            in minutes.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-xl bg-blue-600 px-7 py-3.5 text-base font-semibold shadow-lg shadow-blue-600/30 hover:bg-blue-500"
            >
              Start your free trial
            </Link>
            {demoButton(
              "rounded-xl border border-white/25 px-7 py-3.5 text-base font-medium hover:bg-white/5",
            )}
          </div>
          <p className="mt-3 text-sm text-slate-400">No credit card needed.</p>
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
          <div className="flex items-center gap-5">
            <a href="#industries" className="hover:text-slate-300">
              Industries
            </a>
            <Link href="/pricing" className="hover:text-slate-300">
              Pricing
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
