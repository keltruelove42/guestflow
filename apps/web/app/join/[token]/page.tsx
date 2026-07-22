"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LogoMark } from "@/components/brand/logo";

const NAVY = {
  page: "#050b1e",
  panel: "#0a142e",
  border: "rgba(255,255,255,0.09)",
};

export default function JoinPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;

  const [invite, setInvite] = useState<{ email: string; orgName: string } | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/auth/accept-invite?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        setInvite(await res.json());
      })
      .catch(() => setInvalid(true));
  }, [token]);

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, password }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Could not join");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join");
      setBusy(false);
    }
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-10 text-white antialiased"
      style={{ background: NAVY.page }}
    >
      <div className="mb-8 flex items-center gap-2">
        <LogoMark size={32} />
        <span className="text-lg font-bold tracking-tight">
          Lead<span className="text-sky-300">Coda</span>
        </span>
      </div>

      <div
        className="w-full max-w-md rounded-2xl border p-7 shadow-2xl"
        style={{ background: NAVY.panel, borderColor: NAVY.border }}
      >
        {invalid ? (
          <div className="text-center">
            <div className="text-3xl">😕</div>
            <h1 className="mt-3 text-lg font-semibold">
              This invite is invalid or has expired
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Ask your teammate to send a fresh one.
            </p>
          </div>
        ) : !invite ? (
          <p className="text-center text-sm text-slate-400">Checking your invite…</p>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Join {invite.orgName}
            </h1>
            <p className="mt-1.5 text-sm text-slate-400">
              You are joining as <b className="text-slate-200">{invite.email}</b>. Pick a
              name and password and you are in.
            </p>
            <form onSubmit={accept} className="mt-6 space-y-3">
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
                type="password"
                required
                minLength={8}
                placeholder="Password (8+ characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-xl border bg-white/5 px-3.5 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
                style={{ borderColor: NAVY.border }}
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold hover:bg-blue-500 disabled:opacity-60"
              >
                {busy ? "Joining…" : "Join workspace →"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
