"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { VERTICAL_LIST, type VerticalId } from "@guestflow/shared";
import { LogoMark } from "@/components/brand/logo";

const NAVY = {
  page: "#050b1e",
  panel: "#0a142e",
  card: "rgba(255,255,255,0.045)",
  border: "rgba(255,255,255,0.09)",
};

const COMING_SOON = [
  { icon: "🏠", label: "Real estate" },
  { icon: "🏨", label: "Hotels & B&Bs" },
];

/**
 * Free trial signup, industry standard, two steps:
 *   1. Name + email (nothing else, no credit card)
 *   2. Pick your industry → workspace is created and tailored
 */
export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<VerticalId | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toStep2(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStep(2);
  }

  async function createWorkspace(vertical: VerticalId) {
    setBusy(vertical);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, vertical }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not create your workspace");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(null);
    }
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-10 text-white antialiased"
      style={{ background: NAVY.page }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[420px] w-[640px] -translate-x-1/2 rounded-full bg-blue-600/20 blur-[130px]" />
      </div>

      <Link href="/" className="relative z-10 mb-8 flex items-center gap-2">
        <LogoMark size={32} />
        <span className="text-lg font-bold tracking-tight">
          Lead<span className="text-sky-300">Coda</span>
        </span>
      </Link>

      <div
        className="relative z-10 w-full rounded-2xl border p-7 shadow-2xl"
        style={{
          background: NAVY.panel,
          borderColor: NAVY.border,
          maxWidth: step === 1 ? "26rem" : "34rem",
        }}
      >
        {/* step dots */}
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className={`h-1.5 w-8 rounded-full ${step === 1 ? "bg-blue-500" : "bg-blue-500/40"}`} />
          <span className={`h-1.5 w-8 rounded-full ${step === 2 ? "bg-blue-500" : "bg-white/15"}`} />
        </div>

        {step === 1 ? (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight">Start your free trial</h1>
            <p className="mt-1.5 text-sm text-slate-400">
              No credit card. No commitment. Set up in about 2 minutes.
            </p>
            <form onSubmit={toStep2} className="mt-6 space-y-3">
              <input
                type="text"
                required
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className="w-full rounded-xl border bg-white/5 px-3.5 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
                style={{ borderColor: NAVY.border }}
              />
              <input
                type="email"
                required
                placeholder="Work email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full rounded-xl border bg-white/5 px-3.5 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
                style={{ borderColor: NAVY.border }}
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold hover:bg-blue-500"
              >
                Continue →
              </button>
            </form>
            <p className="mt-4 text-center text-xs text-slate-500">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-400 hover:underline">
                Log in
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight">
              What kind of business are you?
            </h1>
            <p className="mt-1.5 text-sm text-slate-400">
              This tailors your workspace: pipeline, follow-up templates, and examples for your
              industry.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {VERTICAL_LIST.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => createWorkspace(v.id)}
                  className="rounded-xl border p-4 text-left transition-colors hover:border-blue-400/60 hover:bg-blue-500/10 disabled:opacity-60"
                  style={{ background: NAVY.card, borderColor: NAVY.border }}
                >
                  <span className="text-xl">{v.icon}</span>
                  <div className="mt-2 text-sm font-bold">
                    {busy === v.id ? "Setting up your workspace…" : v.label}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">{v.pickerDesc}</div>
                </button>
              ))}
              {COMING_SOON.map((c) => (
                <div
                  key={c.label}
                  className="rounded-xl border p-4 opacity-50"
                  style={{ background: NAVY.card, borderColor: NAVY.border }}
                >
                  <span className="text-xl">{c.icon}</span>
                  <div className="mt-2 text-sm font-bold">{c.label}</div>
                  <div className="mt-0.5 text-xs text-slate-400">Coming soon</div>
                </div>
              ))}
            </div>
            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
            <button
              type="button"
              onClick={() => setStep(1)}
              className="mt-4 text-xs text-slate-500 hover:text-slate-300"
            >
              ← Back
            </button>
          </>
        )}
      </div>

      <p className="relative z-10 mt-6 text-center text-xs text-slate-600">
        Your trial workspace comes pre-loaded with realistic demo data you can clear anytime.
      </p>
    </div>
  );
}
