"use client";

import { OnboardingProvider } from "./onboarding-provider";
import { WelcomeModal } from "./welcome-modal";
import { OnboardingChecklist } from "./checklist";
import { Coachmarks } from "./coachmarks";

export function OnboardingRoot({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingProvider>
      {children}
      <WelcomeModal />
      <OnboardingChecklist />
      <Coachmarks />
    </OnboardingProvider>
  );
}
