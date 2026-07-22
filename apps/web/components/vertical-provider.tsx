"use client";

import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_VERTICAL,
  getVerticalPack,
  type VerticalPack,
} from "@guestflow/shared";

const VerticalContext = createContext<VerticalPack>(getVerticalPack(DEFAULT_VERTICAL));

/**
 * Supplies the org's vertical pack (terminology, labels, copy) to every
 * screen. Defaults to the rentals pack until /auth/me resolves, so existing
 * accounts render exactly as before.
 */
export function VerticalProvider({ children }: { children: React.ReactNode }) {
  const { data } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/v1/auth/me");
      if (!res.ok) throw new Error("Unauthorized");
      return res.json() as Promise<{ vertical?: string }>;
    },
    staleTime: 5 * 60_000,
  });

  return (
    <VerticalContext.Provider value={getVerticalPack(data?.vertical)}>
      {children}
    </VerticalContext.Provider>
  );
}

/** The active vertical pack. Safe anywhere under the app shell. */
export function useVertical(): VerticalPack {
  return useContext(VerticalContext);
}
