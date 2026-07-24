"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VERTICAL_LIST, type VerticalId } from "@guestflow/shared";
import { LogoMark } from "@/components/brand/logo";
import { EmailHeaderPreview } from "@/components/brand/email-preview";
import { Turnstile, turnstileEnabled } from "@/components/turnstile";
import { api } from "@/lib/api";

const NAVY = {
  page: "#050b1e",
  panel: "#0a142e",
  card: "rgba(255,255,255,0.045)",
  border: "rgba(255,255,255,0.09)",
};

const COMING_SOON: Array<{ icon: string; label: string }> = [];

const DEFAULT_PRIMARY = "#1a1a2e";
const DEFAULT_ACCENT = "#047857";
const HEX6 = /^#[0-9a-fA-F]{6}$/;

/** Mirrors the org-name derivation in /api/v1/auth/register so we can prefill it. */
function derivedOrgName(base: string, vertical: VerticalId): string {
  switch (vertical) {
    case "TRADES":
      return `${base}'s Services`;
    case "BEAUTY":
      return `${base}'s Studio`;
    case "DEALERSHIPS":
      return `${base}'s Dealership`;
    case "SAAS":
      return `${base}'s Pipeline`;
    case "ECOMMERCE":
      return `${base}'s Store`;
    case "REALESTATE":
      return `${base}'s Realty`;
    case "HOTELS":
      return `${base}'s Inn`;
    default:
      return `${base}'s Stays`;
  }
}

type SeqStep = {
  id: string;
  channel: "EMAIL" | "SMS" | "CALL";
  delayMinutes: number;
  subject?: string | null;
  body: string;
};

type SequenceItem = {
  id: string;
  name: string;
  active: boolean;
  channelLabel: string;
  steps: SeqStep[];
};

const CHANNEL_ICON: Record<SeqStep["channel"], string> = {
  EMAIL: "✉️",
  SMS: "💬",
  CALL: "📞",
};

function delayLabel(minutes: number): string {
  if (minutes <= 0) return "Right away";
  if (minutes < 60) return `${minutes} min later`;
  if (minutes < 24 * 60) {
    const h = Math.round(minutes / 60);
    return `${h} hour${h === 1 ? "" : "s"} later`;
  }
  const d = Math.round(minutes / (24 * 60));
  return `${d} day${d === 1 ? "" : "s"} later`;
}

/**
 * Free trial signup, industry standard, four steps:
 *   1. Name + email (nothing else, no credit card)
 *   2. Pick your industry → workspace is created and tailored
 *   3. Confirm your brand (name, logo, colors) with a live email preview
 *   4. Meet your starter sequence, branded, then off to the dashboard
 */
export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<VerticalId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  // Step 3 — brand
  const [businessName, setBusinessName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY);
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
  const [uploading, setUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [savingBrand, setSavingBrand] = useState<"save" | "skip" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Step 4 — starter sequence
  const [sequence, setSequence] = useState<SequenceItem | null>(null);

  function toStep2(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStep(2);
  }

  async function createWorkspace(vertical: VerticalId) {
    if (turnstileEnabled && !captchaToken) {
      setError("Please complete the CAPTCHA to continue.");
      return;
    }
    setBusy(vertical);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password, vertical, turnstileToken: captchaToken }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not create your workspace");
      }
      // Session cookie is set — continue onboarding with brand confirmation.
      setBusinessName(derivedOrgName(name || email.split("@")[0]!, vertical));
      setBusy(null);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(null);
    }
  }

  function goToDashboard() {
    router.push("/dashboard");
    router.refresh();
  }

  async function uploadLogo(file: File) {
    setUploading(true);
    setUploadNote(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/v1/uploads?kind=logo", { method: "POST", body: form });
      if (res.status === 503) {
        setUploadNote("Logo upload isn't set up yet — you can add it later in Settings → Brand");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ?? "Could not upload that image",
        );
      }
      const { url } = (await res.json()) as { url: string };
      setLogoUrl(url);
    } catch (err) {
      setUploadNote(err instanceof Error ? err.message : "Could not upload that image");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /** Save (or skip) the brand, then load the starter sequence for step 4. */
  async function finishBrand(save: boolean) {
    setSavingBrand(save ? "save" : "skip");
    setError(null);
    if (save) {
      try {
        await api("/api/v1/org/brand", {
          method: "PUT",
          body: { logoUrl, primaryColor, accentColor, businessName, font: null },
          errorMessage: "Could not save your brand",
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save your brand");
        setSavingBrand(null);
        return;
      }
    }
    try {
      const items = await api<SequenceItem[]>("/api/v1/sequences");
      const picked = items.find((s) => s.active) ?? items[0];
      if (!picked || picked.steps.length === 0) {
        goToDashboard();
        return;
      }
      setSequence(picked);
      setSavingBrand(null);
      setStep(4);
    } catch {
      // No sequences to show — nothing to preview, head straight in.
      goToDashboard();
    }
  }

  const brand = {
    logoUrl,
    primaryColor,
    accentColor,
    businessName,
    font: null as string | null,
  };
  const firstEmailStep = sequence?.steps.find((s) => s.channel === "EMAIL") ?? null;

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-10 text-white antialiased"
      style={{ background: NAVY.page }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[420px] w-[640px] -translate-x-1/2 rounded-full bg-emerald-600/20 blur-[130px]" />
      </div>

      <Link href="/" className="relative z-10 mb-8 flex items-center gap-2">
        <LogoMark size={32} />
        <span className="text-lg font-bold tracking-tight">
          Lead<span className="text-emerald-300">Coda</span>
        </span>
      </Link>

      <div
        className="relative z-10 w-full rounded-2xl border p-7 shadow-2xl"
        style={{
          background: NAVY.panel,
          borderColor: NAVY.border,
          maxWidth: step === 1 ? "26rem" : step === 2 ? "34rem" : "40rem",
        }}
      >
        {/* step dots */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {([1, 2, 3, 4] as const).map((s) => (
            <span
              key={s}
              className={`h-1.5 w-8 rounded-full ${
                step === s ? "bg-emerald-500" : step > s ? "bg-emerald-500/40" : "bg-white/15"
              }`}
            />
          ))}
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
                className="w-full rounded-xl border bg-white/5 px-3.5 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500"
                style={{ borderColor: NAVY.border }}
              />
              <input
                type="email"
                required
                placeholder="Work email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full rounded-xl border bg-white/5 px-3.5 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500"
                style={{ borderColor: NAVY.border }}
              />
              <input
                type="password"
                required
                minLength={8}
                placeholder="Password (8+ characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-xl border bg-white/5 px-3.5 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500"
                style={{ borderColor: NAVY.border }}
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold hover:bg-emerald-500"
              >
                Continue →
              </button>
            </form>
            <p className="mt-4 text-center text-xs text-slate-500">
              Already have an account?{" "}
              <Link href="/login" className="text-emerald-400 hover:underline">
                Log in
              </Link>
            </p>
          </>
        ) : step === 2 ? (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight">
              What kind of business are you?
            </h1>
            <p className="mt-1.5 text-sm text-slate-400">
              This tailors your workspace: pipeline, follow-up templates, and examples for your
              industry.
            </p>
            <div className="mt-4">
              <Turnstile onToken={setCaptchaToken} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {VERTICAL_LIST.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => createWorkspace(v.id)}
                  className="rounded-xl border p-4 text-left transition-colors hover:border-emerald-400/60 hover:bg-emerald-500/10 disabled:opacity-60"
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
        ) : step === 3 ? (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight">Confirm your brand</h1>
            <p className="mt-1.5 text-sm text-slate-400">
              This is how your follow-up emails will look to leads. You can change all of it
              later in Settings → Brand.
            </p>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">
                    Business name
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Your business name"
                    className="w-full rounded-xl border bg-white/5 px-3.5 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500"
                    style={{ borderColor: NAVY.border }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">
                    Logo <span className="font-normal text-slate-500">(optional)</span>
                  </label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadLogo(file);
                    }}
                    className="w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-white/15"
                  />
                  {uploading && <p className="mt-1 text-xs text-slate-500">Uploading…</p>}
                  {uploadNote && <p className="mt-1 text-xs text-slate-500">{uploadNote}</p>}
                </div>
                <ColorField
                  label="Primary color"
                  value={primaryColor}
                  fallback={DEFAULT_PRIMARY}
                  onChange={setPrimaryColor}
                />
                <ColorField
                  label="Accent color"
                  value={accentColor}
                  fallback={DEFAULT_ACCENT}
                  onChange={setAccentColor}
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-slate-400">Live preview</p>
                <EmailHeaderPreview brand={brand} />
              </div>
            </div>
            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                disabled={savingBrand !== null}
                onClick={() => void finishBrand(false)}
                className="text-xs text-slate-500 hover:text-slate-300 disabled:opacity-60"
              >
                Skip for now
              </button>
              <button
                type="button"
                disabled={savingBrand !== null || uploading}
                onClick={() => void finishBrand(true)}
                className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-60"
              >
                {savingBrand === "save" ? "Saving…" : "Continue →"}
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight">Your starter sequence</h1>
            <p className="mt-1.5 text-sm text-slate-400">
              We set up a follow-up sequence for your industry — here it is wearing your brand.
            </p>
            {sequence && (
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div
                  className="rounded-xl border p-4"
                  style={{ background: NAVY.card, borderColor: NAVY.border }}
                >
                  <div className="text-sm font-bold">{sequence.name}</div>
                  <div className="mt-0.5 text-xs text-slate-400">{sequence.channelLabel}</div>
                  <ul className="mt-3 space-y-2.5">
                    {sequence.steps.map((s, i) => (
                      <li key={s.id ?? i} className="flex items-start gap-2.5">
                        <span className="text-base leading-5">{CHANNEL_ICON[s.channel]}</span>
                        <span className="min-w-0">
                          <span className="block text-[11px] uppercase tracking-wide text-slate-500">
                            {delayLabel(s.delayMinutes)}
                          </span>
                          <span className="block truncate text-xs text-slate-300">
                            {s.subject?.trim() || s.body.split("\n")[0]}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-400">
                    First email, your brand
                  </p>
                  <EmailHeaderPreview
                    brand={brand}
                    subject={firstEmailStep?.subject ?? undefined}
                    body={firstEmailStep?.body ?? undefined}
                  />
                </div>
              </div>
            )}
            <p className="mt-4 text-xs text-slate-500">
              You can edit every step later under Follow-ups.
            </p>
            <button
              type="button"
              onClick={goToDashboard}
              className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold hover:bg-emerald-500"
            >
              Go to dashboard →
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

/** Color swatch + hex text input bound to the same value. */
function ColorField({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string;
  fallback: string;
  onChange: (v: string) => void;
}) {
  // <input type="color"> only accepts #rrggbb — fall back while the hex is mid-edit.
  const swatch = HEX6.test(value) ? value : fallback;
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={swatch}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border bg-white/5 p-1"
          style={{ borderColor: NAVY.border }}
          aria-label={`${label} swatch`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            if (!HEX6.test(value)) onChange(fallback);
          }}
          placeholder={fallback}
          spellCheck={false}
          className="w-full rounded-xl border bg-white/5 px-3.5 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500"
          style={{ borderColor: NAVY.border }}
        />
      </div>
    </div>
  );
}
