"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type TrialStatus = {
  onTrial: boolean;
  endsAt: string | null;
  expired: boolean;
  daysLeft: number | null;
  emails: { used: number; limit: number; remaining: number };
  sms: { used: number; limit: number; remaining: number };
};

/**
 * Slim, inline (non-fixed) banner shown at the top of the app while the org is
 * on its free trial. Renders nothing once the org is off-trial.
 */
export function TrialBanner() {
  const { data } = useQuery({
    queryKey: ["trial-status"],
    queryFn: () => api<TrialStatus>("/api/v1/org/trial"),
    staleTime: 2 * 60 * 1000,
  });

  if (!data || !data.onTrial) return null;

  if (data.expired) {
    return (
      <div
        className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-card px-4 py-2 text-sm"
        style={{
          background: "color-mix(in srgb, var(--serious) 15%, transparent)",
          color: "var(--ink)",
        }}
      >
        <span className="font-medium">
          Your free trial has ended — pick a plan to keep sending.
        </span>
        <Link href="/settings/billing" className="shrink-0 font-semibold text-accent">
          Choose a plan →
        </Link>
      </div>
    );
  }

  const emailMaxed = data.emails.used >= data.emails.limit;
  const smsMaxed = data.sms.used >= data.sms.limit;
  const maxedLabel =
    emailMaxed && smsMaxed ? "email and SMS" : emailMaxed ? "email" : "SMS";

  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card px-4 py-2 text-sm"
      style={{
        background: "color-mix(in srgb, var(--accent) 12%, transparent)",
        color: "var(--ink)",
      }}
    >
      <span className="font-medium">
        {data.daysLeft ?? 0} {data.daysLeft === 1 ? "day" : "days"} left in your free
        trial
      </span>
      <span className="text-xs tabular-nums text-ink-2">
        Email {data.emails.used}/{data.emails.limit} · SMS {data.sms.used}/
        {data.sms.limit}
      </span>
      {(emailMaxed || smsMaxed) && (
        <span className="text-xs font-medium" style={{ color: "var(--warn)" }}>
          You&apos;ve used all your trial {maxedLabel} credits.
        </span>
      )}
      <Link
        href="/settings/billing"
        className="ml-auto shrink-0 font-semibold text-accent"
      >
        Upgrade →
      </Link>
    </div>
  );
}
