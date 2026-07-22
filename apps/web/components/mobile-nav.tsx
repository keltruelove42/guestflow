"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard", label: "Home", icon: "◈" },
  { href: "/leads", label: "Leads", icon: "👥" },
  { href: "/followups", label: "Follow-ups", icon: "🔁" },
  { href: "/more", label: "More", icon: "⋯" },
] as const;

/** Thumb-zone bottom tab bar, mobile only. */
export function MobileTabBar({ leadsCount }: { leadsCount?: number }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Primary"
    >
      <div className="grid grid-cols-4">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 text-[11px]",
                active ? "font-semibold text-ink" : "text-muted",
              )}
            >
              <span className="relative text-base leading-none">
                {tab.icon}
                {tab.href === "/leads" && !!leadsCount && (
                  <span className="absolute -right-3 -top-1.5 rounded-pill bg-accent px-1 text-[9px] font-semibold leading-[14px] text-white">
                    {leadsCount > 99 ? "99+" : leadsCount}
                  </span>
                )}
              </span>
              <span>{tab.label}</span>
              {active && (
                <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-accent" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
