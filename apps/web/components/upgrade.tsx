"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

/** Current workspace plan; "TRIAL" until a subscription exists. */
export function usePlan() {
  const { data } = useQuery({
    queryKey: ["billing"],
    queryFn: async () => {
      const res = await fetch("/api/v1/billing");
      if (!res.ok) return { plan: "TRIAL", hasSubscription: false, configured: false };
      return res.json() as Promise<{
        plan: string;
        hasSubscription: boolean;
        configured: boolean;
      }>;
    },
    staleTime: 5 * 60_000,
  });
  const plan = data?.plan ?? "TRIAL";
  return {
    plan,
    isPaid: plan !== "TRIAL",
    hasGrowth: plan === "GROWTH" || plan === "ENTERPRISE",
  };
}

/**
 * Small inline upsell chip next to a Growth-gated feature.
 * Renders nothing once the workspace has Growth or Enterprise.
 */
export function UpgradeChip({ label = "Growth" }: { label?: string }) {
  const { hasGrowth } = usePlan();
  if (hasGrowth) return null;
  return (
    <Link
      href="/billing"
      className="inline-flex items-center gap-1 rounded-pill bg-gradient-to-r from-[#2563eb] to-[#38bdf8] px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm transition-transform hover:scale-105"
      title={`Included with the ${label} plan. Tap to upgrade.`}
    >
      ⚡ {label}
    </Link>
  );
}

/** Sidebar upgrade CTA; hidden for paying workspaces. */
export function SidebarUpgrade() {
  const { isPaid } = usePlan();
  if (isPaid) return null;
  return (
    <Link
      href="/billing"
      className="mx-3 mb-2 flex items-center justify-center gap-1.5 rounded-control bg-gradient-to-r from-[#2563eb] to-[#38bdf8] px-3 py-2 text-xs font-semibold text-white shadow-md transition-transform hover:scale-[1.02]"
    >
      ⚡ Upgrade · from $24/mo
    </Link>
  );
}
