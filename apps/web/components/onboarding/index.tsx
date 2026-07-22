"use client";

import { OnboardingProvider } from "./onboarding-provider";
import { WelcomeModal } from "./welcome-modal";
import { OnboardingChecklist } from "./checklist";
import { Coachmarks } from "./coachmarks";
import { MobileFirstRun } from "./mobile-first-run";
import { useIsMobile } from "@/lib/use-mobile";

function OnboardingSurface() {
  const isMobile = useIsMobile();

  // Mobile best practice: no modals, tours, or checklists on a small screen -
  // one lean first-run sheet, then straight into the product.
  if (isMobile) return <MobileFirstRun />;

  return (
    <>
      <WelcomeModal />
      <OnboardingChecklist />
      <Coachmarks />
    </>
  );
}

export function OnboardingRoot({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingProvider>
      {children}
      <OnboardingSurface />
    </OnboardingProvider>
  );
}
