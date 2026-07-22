"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LogoMark } from "@/components/brand/logo";

const NAVY = {
  page: "#050b1e",
  panel: "#0a142e",
  card: "rgba(255,255,255,0.045)",
  border: "rgba(255,255,255,0.09)",
};

type ApptType = { key: string; label: string; minutes: number; icon: string };

type OrgInfo = {
  name: string;
  types: ApptType[];
  days: number[];
  slotMinutes: number;
};

type Confirmation = { title: string; startAt: string; orgName: string };

type Step = "type" | "time" | "details" | "done";

/** Local YYYY-MM-DD (not UTC, so the org's day boundaries line up). */
function toDateStr(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function dayPillLabel(d: Date): string {
  return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${d.getDate()}`;
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fullWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Public booking page: /book/{slug}. Calendly-simple, three steps in one
 * card. What for? Pick a time. Your details. Then a confirmation screen.
 */
export default function PublicBookingPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [step, setStep] = useState<Step>("type");
  const [error, setError] = useState<string | null>(null);

  const [typeKey, setTypeKey] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [startAt, setStartAt] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<Confirmation | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/booking/${slug}`);
        if (cancelled) return;
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error("Could not load this booking page");
        const data = (await res.json()) as OrgInfo;
        if (cancelled) return;
        setOrg(data);
        if (data.types.length === 1) {
          setTypeKey(data.types[0]!.key);
          setStep("time");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load this booking page");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Next 14 days, keeping only weekdays the org is open.
  const openDays: Date[] = [];
  if (org) {
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + i);
      if (org.days.includes(d.getDay())) openDays.push(d);
    }
  }

  async function loadSlots(dateStr: string, tKey: string) {
    setDay(dateStr);
    setStartAt(null);
    setSlots(null);
    setSlotsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/public/booking/${slug}?date=${dateStr}&type=${encodeURIComponent(tKey)}`,
      );
      const data = (await res.json().catch(() => ({}))) as { slots?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load times");
      const now = Date.now();
      setSlots((data.slots ?? []).filter((s) => new Date(s).getTime() > now));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load times");
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }

  function pickType(key: string) {
    setTypeKey(key);
    setDay(null);
    setSlots(null);
    setStartAt(null);
    setError(null);
    setStep("time");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Please tell us your name");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setError("We need an email or a phone number to confirm your booking");
      return;
    }
    if (!startAt || !typeKey) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/booking/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typeKey,
          startAt,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          notes: notes.trim(),
          consent,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<Confirmation> & {
        ok?: boolean;
        error?: string;
      };
      if (res.status === 409) {
        setError(data.error ?? "That time was just taken. Pick another slot");
        setStep("time");
        if (day) await loadSlots(day, typeKey);
        return;
      }
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not complete your booking");
      setConfirmed({
        title: data.title ?? "Appointment",
        startAt: data.startAt ?? startAt,
        orgName: data.orgName ?? org?.name ?? "",
      });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete your booking");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedType = org?.types.find((t) => t.key === typeKey) ?? null;
  const dotOn = "h-1.5 w-8 rounded-full bg-blue-500";
  const dotDone = "h-1.5 w-8 rounded-full bg-blue-500/40";
  const dotOff = "h-1.5 w-8 rounded-full bg-white/15";
  const inputCls =
    "w-full rounded-xl border bg-white/5 px-3.5 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500";

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-10 text-white antialiased"
      style={{ background: NAVY.page }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[420px] w-[640px] -translate-x-1/2 rounded-full bg-blue-600/20 blur-[130px]" />
      </div>

      <div
        className="relative z-10 w-full max-w-lg rounded-2xl border p-7 shadow-2xl"
        style={{ background: NAVY.panel, borderColor: NAVY.border }}
      >
        {loading ? (
          <p className="py-10 text-center text-sm text-slate-400">Loading…</p>
        ) : notFound ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex justify-center">
              <LogoMark size={36} />
            </div>
            <h1 className="text-xl font-extrabold tracking-tight">
              This booking page is not available
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Check the link you were sent, or contact the business directly.
            </p>
          </div>
        ) : !org ? (
          <p className="py-10 text-center text-sm text-red-400">
            {error ?? "Something went wrong"}
          </p>
        ) : step === "done" && confirmed ? (
          <div className="py-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-4xl text-emerald-400">
              ✓
            </div>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight">You are booked</h1>
            <p className="mt-3 text-sm text-slate-300">
              <span className="font-semibold text-white">{confirmed.title}</span>
              <br />
              {fullWhen(confirmed.startAt)}
              <br />
              with {confirmed.orgName}
            </p>
            <p className="mt-5 text-xs text-slate-500">
              A confirmation is on its way. Need to change it? Just reply to that message.
            </p>
          </div>
        ) : (
          <>
            {/* header */}
            <div className="mb-5 flex items-center gap-3">
              <LogoMark size={30} />
              <div>
                <h1 className="text-lg font-extrabold leading-tight tracking-tight">{org.name}</h1>
                <p className="text-xs text-slate-400">
                  Pick a time, get an instant confirmation.
                </p>
              </div>
            </div>

            {/* step dots */}
            <div className="mb-6 flex items-center justify-center gap-2">
              <span className={step === "type" ? dotOn : dotDone} />
              <span className={step === "time" ? dotOn : step === "details" ? dotDone : dotOff} />
              <span className={step === "details" ? dotOn : dotOff} />
            </div>

            {step === "type" && (
              <>
                <h2 className="text-base font-bold">What for?</h2>
                <div className="mt-4 grid gap-3">
                  {org.types.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => pickType(t.key)}
                      className="flex min-h-[44px] items-center gap-3 rounded-xl border p-4 text-left transition-colors hover:border-blue-400/60 hover:bg-blue-500/10"
                      style={{ background: NAVY.card, borderColor: NAVY.border }}
                    >
                      <span className="text-xl">{t.icon}</span>
                      <span className="flex-1 text-sm font-bold">{t.label}</span>
                      <span className="text-xs text-slate-400">{t.minutes} min</span>
                    </button>
                  ))}
                </div>
                {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
              </>
            )}

            {step === "time" && typeKey && (
              <>
                <h2 className="text-base font-bold">Pick a time</h2>
                {selectedType && (
                  <p className="mt-0.5 text-xs text-slate-400">
                    {selectedType.icon} {selectedType.label} · {selectedType.minutes} min
                  </p>
                )}
                <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-2">
                  {openDays.map((d) => {
                    const ds = toDateStr(d);
                    const active = day === ds;
                    return (
                      <button
                        key={ds}
                        type="button"
                        onClick={() => loadSlots(ds, typeKey)}
                        className={`min-h-[44px] shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                          active
                            ? "border-blue-500 bg-blue-600 text-white"
                            : "text-slate-300 hover:border-blue-400/60"
                        }`}
                        style={active ? undefined : { background: NAVY.card, borderColor: NAVY.border }}
                      >
                        {dayPillLabel(d)}
                      </button>
                    );
                  })}
                </div>
                {openDays.length === 0 && (
                  <p className="mt-3 text-sm text-slate-400">
                    No open days in the next two weeks.
                  </p>
                )}

                {slotsLoading ? (
                  <p className="mt-4 text-sm text-slate-400">Finding open times…</p>
                ) : slots ? (
                  slots.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-400">No open times this day</p>
                  ) : (
                    <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {slots.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setStartAt(s);
                            setError(null);
                            setStep("details");
                          }}
                          className="min-h-[44px] rounded-xl border px-2 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:border-blue-400/60 hover:bg-blue-500/10"
                          style={{ background: NAVY.card, borderColor: NAVY.border }}
                        >
                          {timeLabel(s)}
                        </button>
                      ))}
                    </div>
                  )
                ) : (
                  <p className="mt-4 text-sm text-slate-500">Choose a day to see open times.</p>
                )}

                {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
                {org.types.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setStep("type");
                    }}
                    className="mt-5 min-h-[44px] text-xs text-slate-500 hover:text-slate-300"
                  >
                    ← Back
                  </button>
                )}
              </>
            )}

            {step === "details" && startAt && (
              <>
                <h2 className="text-base font-bold">Your details</h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  {selectedType ? `${selectedType.label} · ` : ""}
                  {fullWhen(startAt)}
                </p>
                <form onSubmit={submit} className="mt-4 space-y-3">
                  <input
                    type="text"
                    required
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    className={inputCls}
                    style={{ borderColor: NAVY.border }}
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className={inputCls}
                    style={{ borderColor: NAVY.border }}
                  />
                  <input
                    type="tel"
                    placeholder="Phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    className={inputCls}
                    style={{ borderColor: NAVY.border }}
                  />
                  <textarea
                    placeholder="Anything we should know? (optional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className={inputCls}
                    style={{ borderColor: NAVY.border }}
                  />
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="h-4 w-4 shrink-0 accent-blue-600"
                    />
                    OK to email or text me about this appointment
                  </label>
                  {error && <p className="text-sm text-red-400">{error}</p>}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="min-h-[44px] w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold hover:bg-blue-500 disabled:opacity-60"
                  >
                    {submitting ? "Booking…" : "Confirm booking"}
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep("time");
                  }}
                  className="mt-4 min-h-[44px] text-xs text-slate-500 hover:text-slate-300"
                >
                  ← Back
                </button>
              </>
            )}
          </>
        )}
      </div>

      <p className="relative z-10 mt-6 text-center text-xs text-slate-600">
        Powered by{" "}
        <a
          href="https://leadcoda.app"
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-500 hover:text-slate-300"
        >
          LeadCoda
        </a>
      </p>
    </div>
  );
}
