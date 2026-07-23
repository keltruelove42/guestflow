"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings/brand", label: "Brand" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/settings/integrations", label: "Integrations" },
  { href: "/settings/team", label: "Team" },
] as const;

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-5">
      <nav
        aria-label="Settings sections"
        className="flex flex-wrap items-center gap-1.5"
      >
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "rounded-control border px-3 py-1.5 text-sm transition-colors",
                active
                  ? "border-accent bg-surface font-medium text-ink"
                  : "border-[var(--border)] bg-surface text-ink-2 hover:text-ink",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
