"use client";

import { useOnboarding } from "./onboarding-provider";
import { useVertical } from "@/components/vertical-provider";

export function WelcomeModal() {
  const { ready, facts, local, dismissWelcome } = useOnboarding();
  const pack = useVertical();

  if (!ready || local.welcomeDismissed) return null;

  const name = facts?.firstName ? `, ${facts.firstName}` : "";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4">
      <div
        role="dialog"
        aria-labelledby="welcome-title"
        className="relative w-full max-w-lg overflow-hidden rounded-card border border-[var(--border)] bg-surface shadow-xl"
      >
        <button
          type="button"
          aria-label="Close welcome"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-control text-lg text-muted hover:bg-surface-2 hover:text-ink"
          onClick={() => dismissWelcome()}
        >
          ×
        </button>

        <div
          className="px-6 pb-2 pt-8"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--accent) 14%, transparent), transparent 70%)",
          }}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-accent">
            Welcome to LeadCoda
          </p>
          <h2 id="welcome-title" className="mt-1 text-2xl font-semibold tracking-tight">
            Glad you&apos;re here{name}
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-2">
            {pack.copy.welcomeTagline} We&apos;ll walk you to your first wins, you can skip or
            close anytime.
          </p>
        </div>

        <div className="grid gap-2 px-6 py-5 sm:grid-cols-3">
          {[
            { icon: "📣", label: pack.copy.welcomeBullets[0] },
            { icon: "🔁", label: pack.copy.welcomeBullets[1] },
            { icon: "✉️", label: pack.copy.welcomeBullets[2] },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-control border border-[var(--border)] bg-page px-3 py-3 text-center"
            >
              <div className="text-lg">{item.icon}</div>
              <div className="mt-1 text-xs font-medium text-ink-2">{item.label}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] px-6 py-4">
          <button
            type="button"
            className="rounded-control px-3 py-2 text-sm text-muted hover:text-ink"
            onClick={() => dismissWelcome()}
          >
            Skip for now
          </button>
          <button
            type="button"
            className="rounded-control border border-[var(--border)] px-3 py-2 text-sm"
            onClick={() => dismissWelcome()}
          >
            I&apos;ll explore myself
          </button>
          <button
            type="button"
            className="rounded-control bg-accent px-3 py-2 text-sm font-medium text-white"
            onClick={() => dismissWelcome({ startTour: true })}
          >
            Show me around
          </button>
        </div>
      </div>
    </div>
  );
}
