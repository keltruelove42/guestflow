import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { TrialBanner } from "@/components/trial-banner";
import { VerifyBanner } from "@/components/verify-banner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted">Loading…</div>}>
      <AppShell>
        <VerifyBanner />
        <TrialBanner />
        {children}
      </AppShell>
    </Suspense>
  );
}
