"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type OnboardingFacts,
  type OnboardingLocalState,
  type OnboardingStepId,
  loadOnboardingState,
  pathVisitKey,
  progressStats,
  saveOnboardingState,
  isStepDone,
} from "@/lib/onboarding";

type Ctx = {
  ready: boolean;
  facts: OnboardingFacts | null;
  local: OnboardingLocalState;
  stats: ReturnType<typeof progressStats>;
  isDone: (id: OnboardingStepId) => boolean;
  dismissWelcome: (opts?: { startTour?: boolean }) => void;
  dismissChecklist: () => void;
  reopenChecklist: () => void;
  setChecklistMinimized: (v: boolean) => void;
  markAction: (id: OnboardingStepId) => void;
  startTour: () => void;
  dismissTour: () => void;
  nextTip: () => void;
  prevTip: () => void;
};

const OnboardingContext = createContext<Ctx | null>(null);

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding requires OnboardingProvider");
  return ctx;
}

export function useOnboardingOptional() {
  return useContext(OnboardingContext);
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const qc = useQueryClient();
  const [local, setLocal] = useState<OnboardingLocalState | null>(null);

  const { data: facts } = useQuery({
    queryKey: ["onboarding-status"],
    queryFn: async () => {
      const res = await fetch("/api/v1/onboarding/status");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<OnboardingFacts>;
    },
  });

  useEffect(() => {
    if (!facts?.orgId) return;
    setLocal(loadOnboardingState(facts.orgId));
  }, [facts?.orgId]);

  const persist = useCallback(
    (next: OnboardingLocalState) => {
      setLocal(next);
      if (facts?.orgId) saveOnboardingState(facts.orgId, next);
    },
    [facts?.orgId],
  );

  // Track page visits for checklist progress
  useEffect(() => {
    if (!facts?.orgId || !local) return;
    const key = pathVisitKey(pathname);
    if (!key) return;
    setLocal((prev) => {
      if (!prev || prev.visited[key]) return prev;
      const next = {
        ...prev,
        visited: { ...prev.visited, [key]: true },
      };
      saveOnboardingState(facts.orgId, next);
      return next;
    });
  }, [pathname, facts?.orgId, local]);

  const state = local ?? {
    welcomeDismissed: true,
    checklistDismissed: true,
    checklistMinimized: false,
    tipsDismissed: true,
    tipIndex: 0,
    tipsActive: false,
    visited: {},
    actions: {},
  };

  const stats = useMemo(
    () => progressStats(state, facts ?? null),
    [state, facts],
  );

  const isDone = useCallback(
    (id: OnboardingStepId) => isStepDone(id, state, facts ?? null),
    [state, facts],
  );

  const value: Ctx = {
    ready: Boolean(local && facts),
    facts: facts ?? null,
    local: state,
    stats,
    isDone,
    dismissWelcome: (opts) => {
      persist({
        ...state,
        welcomeDismissed: true,
        tipsActive: Boolean(opts?.startTour),
        tipIndex: 0,
        tipsDismissed: opts?.startTour ? false : state.tipsDismissed,
      });
    },
    dismissChecklist: () => {
      persist({ ...state, checklistDismissed: true, tipsActive: false });
    },
    reopenChecklist: () => {
      persist({
        ...state,
        checklistDismissed: false,
        checklistMinimized: false,
      });
      void qc.invalidateQueries({ queryKey: ["onboarding-status"] });
    },
    setChecklistMinimized: (v) => {
      persist({ ...state, checklistMinimized: v });
    },
    markAction: (id) => {
      if (state.actions[id]) return;
      persist({
        ...state,
        actions: { ...state.actions, [id]: true },
      });
      void qc.invalidateQueries({ queryKey: ["onboarding-status"] });
    },
    startTour: () => {
      persist({
        ...state,
        tipsActive: true,
        tipsDismissed: false,
        tipIndex: 0,
        welcomeDismissed: true,
      });
    },
    dismissTour: () => {
      persist({
        ...state,
        tipsActive: false,
        tipsDismissed: true,
      });
    },
    nextTip: () => {
      persist({
        ...state,
        tipIndex: state.tipIndex + 1,
      });
    },
    prevTip: () => {
      persist({
        ...state,
        tipIndex: Math.max(0, state.tipIndex - 1),
      });
    },
  };

  return (
    <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
  );
}
