/** Client-side onboarding progress (per org). */

export const ONBOARDING_STEPS = [
  {
    id: "welcome",
    title: "Meet LeadCoda",
    description: "See how ads, CRM, and follow-ups fit together.",
    href: "/dashboard",
    points: 10,
    tipTarget: null as string | null,
  },
  {
    id: "property",
    title: "Review your offerings",
    description: "Confirm what you offer and promote.",
    href: "/properties",
    points: 15,
    tipTarget: "nav-properties",
  },
  {
    id: "integration",
    title: "Connect a channel",
    description: "Link Meta, Hostfully, or another source.",
    href: "/integrations",
    points: 20,
    tipTarget: "nav-integrations",
  },
  {
    id: "sequence",
    title: "Check your follow-ups",
    description: "Sequences email and text leads automatically.",
    href: "/sequences",
    points: 20,
    tipTarget: "nav-sequences",
  },
  {
    id: "campaign",
    title: "Explore ad campaigns",
    description: "Lead forms that drop straight into your CRM.",
    href: "/campaigns",
    points: 20,
    tipTarget: "nav-campaigns",
  },
  {
    id: "simulate",
    title: "Capture a lead",
    description: "Simulate an incoming ad lead (demo) or wait for a real one.",
    href: "/leads",
    points: 25,
    tipTarget: "simulate-lead",
  },
  {
    id: "message",
    title: "Send an email or text",
    description: "Open a lead and send a message from the drawer.",
    href: "/leads",
    points: 30,
    tipTarget: "nav-leads",
  },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];

export type OnboardingFacts = {
  orgId: string;
  orgName: string;
  orgMode: string;
  firstName: string | null;
  ownProperties: number;
  ownSequences: number;
  ownCampaigns: number;
  ownLeads: number;
  connectedIntegrations: number;
  manualMessages: number;
};

export type OnboardingLocalState = {
  welcomeDismissed: boolean;
  checklistDismissed: boolean;
  checklistMinimized: boolean;
  tipsDismissed: boolean;
  tipIndex: number;
  tipsActive: boolean;
  visited: Partial<Record<string, boolean>>;
  actions: Partial<Record<OnboardingStepId, boolean>>;
};

const DEFAULT_LOCAL: OnboardingLocalState = {
  welcomeDismissed: false,
  checklistDismissed: false,
  checklistMinimized: false,
  tipsDismissed: false,
  tipIndex: 0,
  tipsActive: false,
  visited: {},
  actions: {},
};

export function storageKey(orgId: string) {
  return `guestflow:onboarding:v1:${orgId}`;
}

export function loadOnboardingState(orgId: string): OnboardingLocalState {
  if (typeof window === "undefined") return { ...DEFAULT_LOCAL };
  try {
    const raw = localStorage.getItem(storageKey(orgId));
    if (!raw) return { ...DEFAULT_LOCAL, visited: {}, actions: {} };
    const parsed = JSON.parse(raw) as Partial<OnboardingLocalState>;
    return {
      ...DEFAULT_LOCAL,
      ...parsed,
      visited: { ...parsed.visited },
      actions: { ...parsed.actions },
    };
  } catch {
    return { ...DEFAULT_LOCAL, visited: {}, actions: {} };
  }
}

export function saveOnboardingState(orgId: string, state: OnboardingLocalState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(orgId), JSON.stringify(state));
}

export function pathVisitKey(pathname: string): string | null {
  if (pathname.startsWith("/properties")) return "properties";
  if (pathname.startsWith("/integrations")) return "integrations";
  if (pathname.startsWith("/sequences")) return "sequences";
  if (pathname.startsWith("/campaigns")) return "campaigns";
  if (pathname.startsWith("/leads")) return "leads";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  return null;
}

export function isStepDone(
  id: OnboardingStepId,
  local: OnboardingLocalState,
  facts: OnboardingFacts | null,
): boolean {
  if (local.actions[id]) return true;

  switch (id) {
    case "welcome":
      return local.welcomeDismissed;
    case "property":
      return Boolean(local.visited.properties) || (facts?.ownProperties ?? 0) > 0;
    case "integration":
      return (
        Boolean(local.visited.integrations) ||
        (facts?.connectedIntegrations ?? 0) > 0
      );
    case "sequence":
      return Boolean(local.visited.sequences) || (facts?.ownSequences ?? 0) > 0;
    case "campaign":
      return Boolean(local.visited.campaigns) || (facts?.ownCampaigns ?? 0) > 0;
    case "simulate":
      return Boolean(local.actions.simulate) || (facts?.ownLeads ?? 0) > 0;
    case "message":
      return Boolean(local.actions.message) || (facts?.manualMessages ?? 0) > 0;
    default:
      return false;
  }
}

export function progressStats(
  local: OnboardingLocalState,
  facts: OnboardingFacts | null,
) {
  let done = 0;
  let points = 0;
  let earned = 0;
  for (const step of ONBOARDING_STEPS) {
    points += step.points;
    if (isStepDone(step.id, local, facts)) {
      done += 1;
      earned += step.points;
    }
  }
  const pct = Math.round((done / ONBOARDING_STEPS.length) * 100);
  return { done, total: ONBOARDING_STEPS.length, points, earned, pct };
}

export const COACH_TIPS = [
  {
    target: "nav-properties",
    title: "Properties first",
    body: "Everything ties back to a rental. Add or review yours here.",
  },
  {
    target: "nav-integrations",
    title: "Bring leads in",
    body: "Connect Meta, Hostfully, and more so GuestFlow can capture inquiries.",
  },
  {
    target: "nav-sequences",
    title: "Automate follow-ups",
    body: "Email and SMS sequences run after a lead arrives — edit them anytime.",
  },
  {
    target: "nav-campaigns",
    title: "Run lead ads",
    body: "Launch instant-form campaigns; new leads land in your CRM automatically.",
  },
  {
    target: "simulate-lead",
    title: "Try a live capture",
    body: "In demo mode, simulate an incoming lead to watch enrollment and sends.",
  },
  {
    target: "nav-leads",
    title: "Reply from the CRM",
    body: "Open a lead to see the timeline and send an email or text.",
  },
  {
    target: "onboarding-checklist",
    title: "Track your wins",
    body: "This checklist updates as you go. Dismiss it anytime — reopen from the dashboard.",
  },
] as const;
