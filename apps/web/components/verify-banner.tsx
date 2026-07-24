"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

type Me = { emailVerified?: boolean; email?: string; orgMode?: string };

/**
 * In-app nudge shown until the account's email is verified. Live sending is
 * blocked for unverified trial accounts, so this is the unblock path.
 */
export function VerifyBanner() {
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<Me>("/api/v1/auth/me", { errorMessage: "Unauthorized" }),
    staleTime: 2 * 60_000,
  });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Demo workspaces never send live — the verify nag is just noise there.
  if (!me || me.emailVerified !== false || me.orgMode === "DEMO") return null;

  async function resend() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ ok: boolean; sent: boolean }>(
        "/api/v1/auth/resend-verification",
        { method: "POST" },
      );
      if (res.sent) {
        setSent(true);
      } else {
        // Endpoint succeeded but email isn't configured on the server.
        setError(
          "Email sending isn't set up yet — verification emails can't go out until a Resend key and EMAIL_FROM are configured.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resend");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card px-4 py-2.5 text-sm"
      style={{
        background: "color-mix(in srgb, var(--serious) 12%, transparent)",
        color: "var(--serious-text)",
      }}
    >
      <span className="font-medium">Verify your email to start sending.</span>
      <span className="text-ink-2">
        We sent a link to {me.email}. Live emails and texts stay paused until it's confirmed.
      </span>
      {sent ? (
        <span className="ml-auto text-xs text-ink-2">Sent — check your inbox.</span>
      ) : (
        <button
          type="button"
          onClick={resend}
          disabled={busy}
          className="ml-auto rounded-control border border-[var(--border)] bg-surface px-2.5 py-1 text-xs font-medium disabled:opacity-60"
        >
          {busy ? "Sending…" : "Resend link"}
        </button>
      )}
      {error && <span className="w-full text-xs text-critical">{error}</span>}
    </div>
  );
}
