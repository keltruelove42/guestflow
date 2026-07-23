"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { usePlan, UpgradeChip } from "@/components/upgrade";
import { api } from "@/lib/api";
import { formatCents } from "@/lib/format";

type Totals = {
  emailsSent: number;
  opens: number;
  openRatePct: number;
  replies: number;
  replyRatePct: number;
  redemptions: number;
  bookings: number;
};

type SequenceRow = {
  sequenceId: string;
  name: string;
  trigger: string;
  emailsSent: number;
  opens: number;
  openRatePct: number;
  replies: number;
  replyRatePct: number;
  redemptions: number;
  bookings: number;
  bookedRevenueCents: number;
};

type CampaignRow = {
  campaignId: string;
  name: string;
  platform: string;
  bookings: number;
  bookedRevenueCents: number;
};

type TouchpointAnalyticsData = {
  totals: Totals;
  sequences: SequenceRow[];
  campaigns: CampaignRow[];
};

function SectionShell({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-card border border-[var(--border)] bg-surface">
      <div className="flex items-baseline justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Advanced analytics</h2>
          <UpgradeChip />
        </div>
        <span className="text-[11px] text-muted">by touchpoint</span>
      </div>
      {children}
    </section>
  );
}

/** Locked upsell shown when the workspace isn't on Growth/Enterprise. */
function LockedTeaser() {
  return (
    <SectionShell>
      <div className="px-4 py-5">
        <p className="text-sm text-ink-2">
          Open rates, reply rates, code redemptions and booking conversions by
          touchpoint.
        </p>
        <Link
          href="/settings/billing"
          className="mt-3 inline-flex items-center gap-1 rounded-control bg-accent px-3 py-1.5 text-xs font-medium text-white"
        >
          Upgrade to Growth
        </Link>
      </div>
    </SectionShell>
  );
}

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-[var(--border)] bg-surface px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold leading-none tabular-nums tracking-tight">
        {value}
      </div>
      {sub != null && <div className="mt-1.5 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

export function TouchpointAnalytics() {
  const { hasGrowth } = usePlan();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard-touchpoints"],
    queryFn: () =>
      api<TouchpointAnalyticsData>("/api/v1/dashboard/touchpoints"),
    enabled: hasGrowth,
  });

  if (!hasGrowth) return <LockedTeaser />;

  const totals = data?.totals;
  const sequences = data?.sequences ?? [];
  const campaigns = data?.campaigns ?? [];
  const hasSequences = sequences.some(
    (s) => s.emailsSent > 0 || s.bookings > 0 || s.redemptions > 0,
  );

  return (
    <SectionShell>
      <div className="space-y-4 px-4 py-4">
        {isError && (
          <p className="text-sm text-muted">Couldn't load analytics.</p>
        )}

        {/* Totals row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Open rate"
            value={isLoading ? "-" : `${totals?.openRatePct ?? 0}%`}
            sub={
              totals
                ? `${totals.opens.toLocaleString()} / ${totals.emailsSent.toLocaleString()} emails`
                : null
            }
          />
          <StatTile
            label="Reply rate"
            value={isLoading ? "-" : `${totals?.replyRatePct ?? 0}%`}
            sub={
              totals ? `${totals.replies.toLocaleString()} replies` : null
            }
          />
          <StatTile
            label="Redemptions"
            value={isLoading ? "-" : String(totals?.redemptions ?? 0)}
            sub="codes redeemed"
          />
          <StatTile
            label="Bookings"
            value={isLoading ? "-" : String(totals?.bookings ?? 0)}
            sub="direct conversions"
          />
        </div>

        {/* By touchpoint table */}
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
            By touchpoint
          </h3>
          {isLoading ? (
            <p className="py-4 text-sm text-muted">Loading…</p>
          ) : !hasSequences ? (
            <p className="py-4 text-sm text-muted">
              No touchpoint activity yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wider text-muted">
                    <th className="py-2 pr-3 font-medium">Touchpoint</th>
                    <th className="py-2 px-2 text-right font-medium">Sent</th>
                    <th className="py-2 px-2 text-right font-medium">Opens</th>
                    <th className="py-2 px-2 text-right font-medium">Replies</th>
                    <th className="py-2 px-2 text-right font-medium">Redeem</th>
                    <th className="py-2 px-2 text-right font-medium">Bookings</th>
                    <th className="py-2 pl-2 text-right font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {sequences.map((s) => (
                    <tr
                      key={s.sequenceId}
                      className="border-b border-[var(--border)] last:border-0"
                    >
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-ink">{s.name}</div>
                        <div className="mt-0.5">
                          <Badge tone="neutral" size="xs">
                            {s.trigger}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-ink-2">
                        {s.emailsSent.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-ink-2">
                        {s.opens.toLocaleString()}{" "}
                        <span className="text-muted">({s.openRatePct}%)</span>
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-ink-2">
                        {s.replies.toLocaleString()}{" "}
                        <span className="text-muted">({s.replyRatePct}%)</span>
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-ink-2">
                        {s.redemptions.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-ink-2">
                        {s.bookings.toLocaleString()}
                      </td>
                      <td
                        className="py-2.5 pl-2 text-right font-medium tabular-nums"
                        style={{
                          color:
                            s.bookedRevenueCents > 0
                              ? "var(--good-text)"
                              : undefined,
                        }}
                      >
                        {formatCents(s.bookedRevenueCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bookings by campaign */}
        {campaigns.length > 0 && (
          <div>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
              Bookings by campaign
            </h3>
            <ul className="space-y-1">
              {campaigns.map((c) => (
                <li
                  key={c.campaignId}
                  className="flex items-center justify-between gap-3 rounded-control px-1 py-1.5"
                >
                  <div className="min-w-0 flex-1 truncate text-sm">
                    <span className="font-medium text-ink">{c.name}</span>{" "}
                    <span className="text-muted">({c.platform})</span>
                  </div>
                  <div className="shrink-0 text-right text-sm tabular-nums">
                    <span className="font-medium text-ink-2">
                      {c.bookings.toLocaleString()} bookings
                    </span>
                    <span
                      className="ml-2 font-medium"
                      style={{ color: "var(--good-text)" }}
                    >
                      {formatCents(c.bookedRevenueCents)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SectionShell>
  );
}
