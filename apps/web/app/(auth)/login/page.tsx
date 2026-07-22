"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogoLockup } from "@/components/brand/logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
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
          <LogoLockup size={34} textClass="text-2xl" />
          <p className="mt-2 text-sm text-ink-2">
            Welcome back. Sign in to your workspace.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
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
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-2">Password</label>
            <input
              type="password"
              required
              minLength={8}
              className="w-full rounded-control border border-[var(--border)] bg-page px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-critical">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-control bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted">
          New to LeadCoda?{" "}
          <a href="/signup" className="text-accent hover:underline">
            Start a free trial
          </a>
        </p>
      </div>
    </div>
  );
}
