import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/brand/logo";

/* Shared shell for LeadCoda legal pages (privacy, terms, dpa).
   Server-compatible: no client hooks, Tailwind classes only. */

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen overflow-x-clip bg-[#050b1e] text-white antialiased">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark size={28} />
            <span className="font-bold tracking-tight">
              <span className="text-white">Lead</span>
              <span className="text-sky-300">Coda</span>
            </span>
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Start free trial
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-5 py-12 [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-white [&_p]:mt-3 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-slate-300 [&_a]:text-sky-300 [&_a]:underline [&_a]:underline-offset-2">
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="!mt-2 text-xs !text-slate-500">Last updated: {updated}</p>
        {children}
      </article>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-5 py-8 text-xs text-slate-500">
          <span>© {new Date().getFullYear()} LeadCoda</span>
          <Link href="/privacy" className="hover:text-slate-300">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-slate-300">
            Terms
          </Link>
          <Link href="/dpa" className="hover:text-slate-300">
            DPA
          </Link>
          <Link href="/security" className="hover:text-slate-300">
            Security
          </Link>
          <Link href="/pricing" className="hover:text-slate-300">
            Pricing
          </Link>
        </div>
      </footer>
    </div>
  );
}
