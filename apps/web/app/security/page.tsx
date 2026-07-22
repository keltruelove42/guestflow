import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Trust & Security · LeadCoda",
  description:
    "How LeadCoda protects your data: encryption in transit and at rest, TCPA and CAN-SPAM compliant messaging, GDPR and CCPA readiness, and PCI-compliant payments via Stripe.",
};

const NAVY = {
  page: "#050b1e",
  panel: "#0a142e",
  card: "rgba(255,255,255,0.045)",
  border: "rgba(255,255,255,0.09)",
};

/* Every badge here is factually true of the product today. Certification
   badges (SOC 2, ISO) are intentionally absent until earned. */
const BADGES = [
  {
    icon: "🔒",
    name: "TLS 1.2+ everywhere",
    desc: "All traffic between you, your leads, and LeadCoda is encrypted in transit.",
  },
  {
    icon: "🗄️",
    name: "Encrypted at rest",
    desc: "Databases are encrypted at rest, and API keys and tokens get an extra layer of application-level encryption.",
  },
  {
    icon: "📵",
    name: "TCPA-aware texting",
    desc: "Per-lead SMS consent records, STOP opt-outs honored automatically, quiet hours enforced.",
  },
  {
    icon: "📧",
    name: "CAN-SPAM compliant email",
    desc: "Unsubscribe links are enforced on every marketing email, and opt-outs stop sequences instantly.",
  },
  {
    icon: "🇪🇺",
    name: "GDPR-ready",
    desc: "Data export and deletion on request, a signable DPA, and documented subprocessors.",
  },
  {
    icon: "🛡️",
    name: "CCPA-ready",
    desc: "We never sell personal information. Know, access, and delete rights honored.",
  },
  {
    icon: "💳",
    name: "PCI DSS payments via Stripe",
    desc: "Card details go straight to Stripe and never touch LeadCoda servers.",
  },
  {
    icon: "🔑",
    name: "Least-privilege access",
    desc: "Workspace data is isolated per customer, and sessions use signed, httpOnly cookies.",
  },
];

const SUBPROCESSORS = [
  ["Vercel", "Application hosting", "United States"],
  ["Neon", "Database (PostgreSQL)", "United States"],
  ["Resend", "Email delivery", "United States"],
  ["Twilio", "SMS delivery", "United States"],
  ["Stripe", "Payments and billing", "United States"],
  ["Meta Platforms", "Lead ads sync (only when you connect it)", "United States"],
];

export default function SecurityPage() {
  return (
    <div
      className="min-h-screen overflow-x-clip text-white antialiased"
      style={{ background: NAVY.page }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[420px] w-[640px] -translate-x-1/2 rounded-full bg-blue-600/20 blur-[130px]" />
      </div>

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark size={30} />
          <span className="text-lg font-bold tracking-tight">
            Lead<span className="text-sky-300">Coda</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/pricing" className="hidden text-sm text-slate-300 hover:text-white sm:block">
            Pricing
          </Link>
          <Link
            href="/signup"
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500"
          >
            Start free trial
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-3xl px-5 pt-10 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
          🔐 Trust & Security
        </span>
        <h1 className="mt-5 text-4xl font-extrabold tracking-tight md:text-5xl">
          Your leads are your business. We treat them that way.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
          Security and messaging compliance are built into how LeadCoda works, not bolted
          on. Here is exactly where we stand, with nothing overstated.
        </p>
      </section>

      {/* Badges */}
      <section className="relative z-10 mx-auto max-w-5xl px-5 py-14">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BADGES.map((b) => (
            <div
              key={b.name}
              className="rounded-2xl border p-5 text-center"
              style={{ background: NAVY.card, borderColor: NAVY.border }}
            >
              <div className="text-3xl">{b.icon}</div>
              <h2 className="mt-2 text-sm font-bold">{b.name}</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Practices */}
      <section className="relative z-10 mx-auto max-w-3xl space-y-8 px-5 py-6">
        <div>
          <h2 className="text-xl font-bold">Consent is enforced by the product</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Every lead carries its own email and SMS consent record with a timestamp.
            Sequences check consent before every single send. A STOP reply or an
            unsubscribe click halts messaging to that lead immediately, across every
            sequence, and the product will not let an SMS-first template ship without
            opt-out language. Imported lists carry per-row consent so old spreadsheets
            cannot silently become spam.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-bold">Your data stays yours</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            You own your workspace data and can export it or ask for deletion at any
            time. We never sell personal information and never use your leads to
            advertise or to train anything. When you connect an integration, its
            credentials are encrypted with application-level encryption before they are
            stored, and they are only decrypted at the moment of use.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-bold">Subprocessors</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            LeadCoda runs on a small, deliberate set of infrastructure providers. Each
            one processes data only for the purpose listed.
          </p>
          <div
            className="mt-4 overflow-hidden rounded-2xl border"
            style={{ background: NAVY.card, borderColor: NAVY.border }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: NAVY.border }}>
                  <th className="px-4 py-3 font-semibold text-slate-400">Provider</th>
                  <th className="px-4 py-3 font-semibold text-slate-400">Purpose</th>
                  <th className="px-4 py-3 font-semibold text-slate-400">Region</th>
                </tr>
              </thead>
              <tbody>
                {SUBPROCESSORS.map((row) => (
                  <tr
                    key={row[0]}
                    className="border-t"
                    style={{ borderColor: "rgba(255,255,255,0.05)" }}
                  >
                    <td className="px-4 py-2.5 font-medium">{row[0]}</td>
                    <td className="px-4 py-2.5 text-slate-300">{row[1]}</td>
                    <td className="px-4 py-2.5 text-slate-400">{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold">On our roadmap, stated honestly</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            SOC 2 Type II certification is planned as we grow. We only display badges we
            have actually earned, so you will see it here the day the audit completes and
            not a day before. In the meantime our practices above are written to align
            with SOC 2 trust principles from day one.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-bold">Found something?</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            We welcome responsible disclosure. Email{" "}
            <a href="mailto:security@leadcoda.com" className="text-sky-300 hover:underline">
              security@leadcoda.com
            </a>{" "}
            and we will respond within two business days.
          </p>
        </div>
        <p className="text-xs text-slate-500">
          See also our <Link href="/privacy" className="text-sky-300 hover:underline">Privacy Policy</Link>,{" "}
          <Link href="/terms" className="text-sky-300 hover:underline">Terms of Service</Link>, and{" "}
          <Link href="/dpa" className="text-sky-300 hover:underline">Data Processing Agreement</Link>.
        </p>
      </section>

      {/* Footer */}
      <footer className="relative z-10 mt-10 border-t border-white/10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-slate-500 md:flex-row">
          <div className="flex items-center gap-2">
            <LogoMark size={22} />
            <span className="font-semibold text-slate-300">LeadCoda</span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <Link href="/pricing" className="hover:text-slate-300">Pricing</Link>
            <Link href="/privacy" className="hover:text-slate-300">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-300">Terms</Link>
            <Link href="/dpa" className="hover:text-slate-300">DPA</Link>
            <Link href="/signup" className="hover:text-slate-300">Free trial</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
