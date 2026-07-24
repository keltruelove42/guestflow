"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Icon, type IconName } from "@/components/ui/icons";

const SETTINGS_LINKS = [
  { href: "/settings/brand", icon: "🎨", label: "Brand" },
  { href: "/settings/billing", icon: "💳", label: "Billing" },
  { href: "/settings/integrations", icon: "🔌", label: "Integrations" },
  { href: "/settings/team", icon: "🧑‍🤝‍🧑", label: "Team" },
] as const;

const DESKTOP_FEATURES = [
  { icon: "megaphone", label: "Ad Campaigns", desc: "Launch and edit lead-gen campaigns" },
  { icon: "repeat", label: "Sequence editor", desc: "Design automated follow-up flows" },
  { icon: "🏘️", label: "Properties", desc: "Manage listings, photos & calendars" },
  { icon: "🔌", label: "Integrations", desc: "Connect Meta, Hostfully, Twilio & more" },
];

/** Mobile "More" tab: account info + what lives on desktop + sign out. */
export default function MorePage() {
  const router = useRouter();

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

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <section className="rounded-card border border-[var(--border)] bg-surface p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-lg">
            {(me?.name ?? me?.email ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{me?.name ?? me?.email ?? "…"}</div>
            <div className="truncate text-xs text-muted">{me?.orgName ?? ""}</div>
          </div>
          <span className="ml-auto rounded-pill bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
            {me?.orgMode ?? "DEMO"}
          </span>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Settings</h2>
        <div className="overflow-hidden rounded-card border border-[var(--border)] bg-surface">
          {SETTINGS_LINKS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="flex min-h-[48px] items-center gap-3 border-b border-[var(--border)] px-4 py-3 last:border-0"
            >
              <span className="text-ink-2"><Icon name={s.icon as IconName} size={15} /></span>
              <span className="text-sm font-medium">{s.label}</span>
              <span className="ml-auto text-muted">›</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">On your desktop</h2>
        <p className="mb-3 text-xs text-muted">
          Heavier setup lives on the desktop app, where there&apos;s room to work:
        </p>
        <div className="overflow-hidden rounded-card border border-[var(--border)] bg-surface">
          {DESKTOP_FEATURES.map((f) => (
            <div
              key={f.label}
              className="flex min-h-[52px] items-center gap-3 border-b border-[var(--border)] px-4 py-3 last:border-0"
            >
              <span className="text-ink-2"><Icon name={f.icon as IconName} size={15} /></span>
              <div className="min-w-0">
                <div className="text-sm font-medium">{f.label}</div>
                <div className="truncate text-xs text-muted">{f.desc}</div>
              </div>
              <span className="ml-auto rounded-pill bg-surface-2 px-2 py-0.5 text-[10px] text-muted">
                desktop
              </span>
            </div>
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={logout}
        className="w-full rounded-control border border-[var(--border)] bg-surface py-2.5 text-sm text-critical"
      >
        Sign out
      </button>
    </div>
  );
}
