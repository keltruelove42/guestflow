"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * Typed react-query hooks for the endpoints that were previously fetched with
 * copy-pasted inline `queryFn`s across app-shell, leads, campaigns, calendar
 * and sequences. One query key + one fetcher per endpoint, defined once.
 */

export type Me = {
  name: string | null;
  email: string;
  orgMode: string;
  orgName: string;
};

export type Property = { id: string; name: string };

export type SequenceStep = {
  id?: string;
  order?: number;
  delayMinutes: number;
  channel: "EMAIL" | "SMS" | "CALL";
  subject: string | null;
  body: string;
};

export type Sequence = {
  id: string;
  name: string;
  trigger: string;
  active: boolean;
  channelLabel: string;
  isDemo?: boolean;
  heroPhotoUrl?: string | null;
  steps: SequenceStep[];
  stats: { enrolled: number; replies: number; replyRate: number; booked: number };
};

export type DeliveryStatus = {
  orgMode: string;
  sendMode: string | null;
  email: "live" | "log";
  sms: "live" | "log";
  emailFrom: string | null;
};

export type OrgVariables = { variables: Record<string, string> };

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api<Me>("/api/v1/auth/me", { errorMessage: "Unauthorized" }),
  });
}

export function useProperties() {
  return useQuery({
    queryKey: ["properties"],
    queryFn: () => api<Property[]>("/api/v1/properties"),
  });
}

export function useSequences() {
  return useQuery({
    queryKey: ["sequences"],
    queryFn: () =>
      api<Sequence[]>("/api/v1/sequences", {
        errorMessage: "Failed to load sequences",
      }),
  });
}

export function useMessagingStatus() {
  return useQuery({
    queryKey: ["messaging-status"],
    queryFn: () => api<DeliveryStatus>("/api/v1/messaging/status"),
  });
}

export function useOrgVariables() {
  return useQuery({
    queryKey: ["org-variables"],
    queryFn: () =>
      api<OrgVariables>("/api/v1/org/variables", {
        errorMessage: "Failed to load variables",
      }),
  });
}
