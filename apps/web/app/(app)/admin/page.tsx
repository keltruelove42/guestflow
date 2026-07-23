"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";

type AdminOrg = {
  id: string;
  name: string;
  ownerEmail: string;
  plan: string;
  mode: string;
  vertical: string;
  trialEndsAt: string | null;
  createdAt: string;
  userCount: number;
  leadCount: number;
  sequenceCount: number;
  totalSends: number;
  bookings: number;
  lastActivityAt: string | null;
};

const PLAN_TONE: Record<string, BadgeTone> = {
  TRIAL: "muted",
  STARTER: "neutral",
  GROWTH: "accent",
  ENTERPRISE: "good",
};

function planTone(plan: string): BadgeTone {
  return PLAN_TONE[plan] ?? "neutral";
}

/** null → "—", past → expired, else "Nd left" */
function trialCell(trialEndsAt: string | null) {
  if (!trialEndsAt) return <span className="text-muted">—</span>;
  const end = new Date(trialEndsAt).getTime();
  const days = Math.ceil((end - Date.now()) / 86_400_000);
  if (days <= 0) {
    return <span className="font-medium text-critical">expired</span>;
  }
  return <span className="tabular-nums">{days}d left</span>;
}

export default function AdminOrgsPage() {
  const [query, setQuery] = useState("");

  const { data: orgs = [], isLoading, error } = useQuery({
    queryKey: ["admin-orgs"],
    queryFn: () => api<AdminOrg[]>("/api/v1/admin/orgs"),
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.ownerEmail.toLowerCase().includes(q),
    );
  }, [orgs, query]);

  if (isLoading) {
    return <div className="text-sm text-muted">Loading workspaces…</div>;
  }
  if (error) {
    return (
      <div className="rounded-card border border-[var(--border)] bg-surface p-6 text-sm text-critical">
        {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-ink-2">
          <span className="font-medium text-ink">{orgs.length}</span>{" "}
          {orgs.length === 1 ? "workspace" : "workspaces"}
        </div>
        <Input
          type="search"
          placeholder="Search by name or owner email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-xs"
        />
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-card border border-[var(--border)] bg-surface md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-muted">
              <th className="px-4 py-2.5 font-medium">Workspace</th>
              <th className="px-4 py-2.5 font-medium">Plan</th>
              <th className="px-4 py-2.5 font-medium">Mode</th>
              <th className="px-4 py-2.5 text-right font-medium">Leads</th>
              <th className="px-4 py-2.5 text-right font-medium">Sends</th>
              <th className="px-4 py-2.5 text-right font-medium">Bookings</th>
              <th className="px-4 py-2.5 font-medium">Trial</th>
              <th className="px-4 py-2.5 font-medium">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr
                key={o.id}
                className="border-b border-[var(--border)] last:border-0 hover:bg-surface-2/60"
              >
                <td className="px-4 py-2.5">
                  <Link href={`/admin/${o.id}`} className="block">
                    <div className="font-medium text-ink hover:text-accent">
                      {o.name}
                    </div>
                    <div className="text-xs text-muted">{o.ownerEmail}</div>
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <Badge tone={planTone(o.plan)}>{o.plan}</Badge>
                </td>
                <td className="px-4 py-2.5 text-ink-2">{o.mode}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-ink-2">
                  {o.leadCount}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-ink-2">
                  {o.totalSends}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-ink-2">
                  {o.bookings}
                </td>
                <td className="px-4 py-2.5">{trialCell(o.trialEndsAt)}</td>
                <td className="px-4 py-2.5 text-ink-2">
                  {o.lastActivityAt ? (
                    relativeTime(o.lastActivityAt)
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted">
                  No workspaces match “{query}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {filtered.map((o) => (
          <Link
            key={o.id}
            href={`/admin/${o.id}`}
            className="block rounded-card border border-[var(--border)] bg-surface p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-medium text-ink">{o.name}</div>
                <div className="truncate text-xs text-muted">{o.ownerEmail}</div>
              </div>
              <Badge tone={planTone(o.plan)}>{o.plan}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
              <span>{o.mode}</span>
              <span>{o.leadCount} leads</span>
              <span>{o.totalSends} sends</span>
              <span>{o.bookings} bookings</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span>{trialCell(o.trialEndsAt)}</span>
              <span className="text-muted">
                {o.lastActivityAt ? relativeTime(o.lastActivityAt) : "—"}
              </span>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-card border border-[var(--border)] bg-surface p-6 text-center text-sm text-muted">
            No workspaces match “{query}”.
          </div>
        )}
      </div>
    </div>
  );
}
