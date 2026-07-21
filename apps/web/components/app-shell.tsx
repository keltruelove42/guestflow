"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DemoDataBanner } from "@/components/demo-banner";
import { OnboardingRoot } from "@/components/onboarding";
import { useOnboardingOptional } from "@/components/onboarding/onboarding-provider";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "◈", tour: "nav-dashboard" },
  { href: "/leads", label: "Leads", icon: "👥", tour: "nav-leads" },
  { href: "/campaigns", label: "Ad Campaigns", icon: "📣", tour: "nav-campaigns" },
  { href: "/sequences", label: "Follow-ups", icon: "🔁", tour: "nav-sequences" },
  { href: "/properties", label: "Properties", icon: "🏘️", tour: "nav-properties" },
  { href: "/integrations", label: "Integrations", icon: "🔌", tour: "nav-integrations" },
] as const;

type Property = { id: string; name: string };

function SimulateButton() {
  const qc = useQueryClient();
  const onboarding = useOnboardingOptional();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function simulate() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/simulate/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "ad", platform: "META" }),
      });
      if (!res.ok) throw new Error("Simulate failed");
      const data = await res.json();
      const name = data.lead?.name ?? "Lead";
      const prop = data.lead?.property?.name ?? "your property";
      setToast(`⚡ ${name} just came in via Meta — ${prop}`);
      onboarding?.markAction("simulate");
      await qc.invalidateQueries({ queryKey: ["leads"] });
      await qc.invalidateQueries({ queryKey: ["leads-count"] });
      await qc.invalidateQueries({ queryKey: ["sequences"] });
      await qc.invalidateQueries({ queryKey: ["onboarding-status"] });
      setTimeout(() => setToast(null), 5000);
    } catch {
      setToast("Could not simulate lead");
      setTimeout(() => setToast(null), 4000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        data-tour="simulate-lead"
        disabled={busy}
        onClick={simulate}
        className="rounded-control border border-[var(--border)] bg-page px-3 py-1.5 text-sm text-ink-2 disabled:opacity-60"
      >
        {busy ? "Simulating…" : "⚡ Simulate incoming lead"}
      </button>
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-card border border-[var(--border)] bg-surface px-4 py-3 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const property = searchParams.get("property") ?? "all";

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/v1/auth/me");
      if (!res.ok) throw new Error("Unauthorized");
      return res.json() as Promise<{
        name: string | null;
        email: string;
        orgMode: string;
        orgName: string;
      }>;
    },
  });

  const { data: properties = [] } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const res = await fetch("/api/v1/properties");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<Property[]>;
    },
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads-count"],
    queryFn: async () => {
      const res = await fetch("/api/v1/leads");
      if (!res.ok) return [];
      return res.json() as Promise<unknown[]>;
    },
  });

  const title =
    NAV.find((n) => pathname.startsWith(n.href))?.label ?? "GuestFlow";

  function setProperty(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (id === "all") params.delete("property");
    else params.set("property", id);
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-page text-ink">
      <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--border)] bg-surface">
        <div className="px-4 py-5">
          <div className="text-lg font-semibold tracking-tight">GuestFlow</div>
          <div className="mt-0.5 truncate text-xs text-muted">{me?.orgName ?? "…"}</div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-2">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            const count =
              item.href === "/leads"
                ? leads.length
                : item.href === "/properties"
                  ? properties.length
                  : null;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-tour={item.tour}
                className={cn(
                  "flex items-center gap-2 rounded-control px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-surface-2 font-medium text-ink"
                    : "text-ink-2 hover:bg-surface-2/70 hover:text-ink",
                )}
              >
                <span className="w-5 text-center text-xs opacity-80">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {count != null && (
                  <span className="rounded-pill bg-surface-2 px-1.5 text-[10px] tabular-nums text-muted">
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[var(--border)] p-3">
          <div className="truncate text-xs text-ink-2">{me?.name ?? me?.email}</div>
          <div className="mt-0.5 flex items-center justify-between">
            <span className="rounded-pill bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
              {me?.orgMode ?? "DEMO"}
            </span>
            <button
              type="button"
              onClick={logout}
              className="text-[11px] text-muted hover:text-ink"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <DemoDataBanner />
        <header className="flex h-14 items-center justify-between gap-4 border-b border-[var(--border)] bg-surface px-6">
          <h1 className="text-base font-semibold">{title}</h1>
          <div className="flex items-center gap-3">
            <select
              className="rounded-control border border-[var(--border)] bg-page px-2.5 py-1.5 text-sm text-ink outline-none"
              value={property}
              onChange={(e) => setProperty(e.target.value)}
            >
              <option value="all">All properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {me?.orgMode === "DEMO" && <SimulateButton />}
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingRoot>
      <ShellInner>{children}</ShellInner>
    </OnboardingRoot>
  );
}
