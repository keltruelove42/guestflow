"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { useOnboarding } from "./onboarding-provider";

const KEY = (orgId: string) => `gf-mobile-welcome-${orgId}`;

/**
 * Mobile onboarding, best-practice edition: one compact bottom sheet on first
 * run, value prop in a sentence, three glanceable capabilities, one button.
 * No tours, no checklists, no modals; users get to their leads immediately.
 */
export function MobileFirstRun() {
  const { ready, facts } = useOnboarding();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!ready || !facts?.orgId) return;
    try {
      if (!localStorage.getItem(KEY(facts.orgId))) setOpen(true);
    } catch {
      /* storage unavailable, skip onboarding rather than block */
    }
  }, [ready, facts?.orgId]);

  function dismiss() {
    setOpen(false);
    try {
      if (facts?.orgId) localStorage.setItem(KEY(facts.orgId), "1");
    } catch {
      /* ignore */
    }
  }

  if (!open) return null;

  const name = facts?.firstName ? `, ${facts.firstName}` : "";

  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/45" onClick={dismiss}>
      <div
        role="dialog"
        aria-labelledby="mobile-welcome-title"
        className="w-full rounded-t-2xl border-t border-[var(--border)] bg-surface px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-surface-2" />
        <h2 id="mobile-welcome-title" className="text-lg font-semibold">
          Welcome{name} 👋
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          LeadCoda on your phone is built for staying on top of things:
        </p>
        <ul className="mt-3 space-y-2.5 text-sm">
          <li className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2">
              <Icon name="users" size={14} />
            </span>
            See new leads the moment they come in
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2">
              <Icon name="message" size={14} />
            </span>
            Reply by email or SMS in two taps
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2">
              <Icon name="repeat" size={14} />
            </span>
            Check follow-ups that need a human touch
          </li>
        </ul>
        <p className="mt-3 text-xs text-muted">
          Campaign and sequence building live on desktop, where there&apos;s room to work.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="mt-4 w-full rounded-control bg-accent py-3 text-sm font-medium text-white"
        >
          Let&apos;s go
        </button>
      </div>
    </div>
  );
}
