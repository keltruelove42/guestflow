"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("taylor@guestflow.demo");
  const [name, setName] = useState("Taylor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Login failed");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="w-full max-w-md rounded-card border border-[var(--border)] bg-surface p-8 shadow-sm">
        <div className="mb-8">
          <div className="text-2xl font-semibold tracking-tight text-ink">GuestFlow</div>
          <p className="mt-2 text-sm text-ink-2">
            Capture leads, run follow-ups, and convert bookings — demo mode ready.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-2">Name</label>
            <input
              className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-2">Email</label>
            <input
              type="email"
              required
              className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          {error && <p className="text-sm text-critical">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-control bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Continue in demo mode"}
          </button>
        </form>

        <p className="mt-6 text-xs leading-relaxed text-muted">
          First sign-in creates your org and loads the prototype demo data (properties, campaigns,
          sequences, and leads). Supabase magic-link / Google auth can be enabled via env vars later.
        </p>
      </div>
    </div>
  );
}
