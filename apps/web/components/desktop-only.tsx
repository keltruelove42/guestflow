"use client";

import Link from "next/link";

/**
 * Wraps screens that involve heavy configuration (builders, editors, OAuth).
 * On mobile, shows a friendly pointer to desktop instead of a cramped UI —
 * mobile stays focused on tasks that are easy to complete on the go.
 */
export function DesktopOnly({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="md:hidden">
        <div className="mx-auto mt-10 max-w-sm rounded-card border border-[var(--border)] bg-surface p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-xl">
            🖥️
          </div>
          <h2 className="mt-4 text-base font-semibold">{title} works best on desktop</h2>
          <p className="mt-2 text-sm text-ink-2">{description}</p>
          <div className="mt-5 flex flex-col gap-2">
            <Link
              href="/leads"
              className="rounded-control bg-accent px-4 py-2.5 text-sm font-medium text-white"
            >
              Go to Leads
            </Link>
            <Link
              href="/dashboard"
              className="rounded-control border border-[var(--border)] px-4 py-2.5 text-sm"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
      <div className="hidden md:block">{children}</div>
    </>
  );
}
