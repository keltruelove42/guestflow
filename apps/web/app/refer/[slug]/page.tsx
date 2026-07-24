"use client";

import { Suspense, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

function ReferInner() {
  const params = useParams();
  const search = useSearchParams();
  const slug = String(params?.slug ?? "");
  const ref = search.get("ref") ?? "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || (!email.trim() && !phone.trim())) {
      setError("Add your name and an email or phone.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/refer/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, ref, consent }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Something went wrong");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      {done ? (
        <div className="text-center">
          <div className="mb-3 text-4xl">🎉</div>
          <h1 className="text-xl font-bold">You're all set!</h1>
          <p className="mt-2 text-sm text-slate-500">
            Thanks — we'll reach out shortly. We appreciate the referral!
          </p>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-extrabold tracking-tight">You've been referred 👋</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Leave your details and we'll take great care of you.
          </p>
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              type="email"
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="w-full rounded-xl border px-3 py-2.5 text-sm"
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <label className="flex items-start gap-2 text-xs text-slate-500">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>It's OK to contact me by email or text about my inquiry.</span>
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Sending…" : "Get in touch"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default function ReferralPage() {
  return (
    <Suspense fallback={null}>
      <ReferInner />
    </Suspense>
  );
}
