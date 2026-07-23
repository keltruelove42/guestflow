"use client";

import type { BoardLead } from "@/components/leads-views";

/** Lead list row shape (leads index page). */
export type Lead = BoardLead & {
  travelDates: string | null;
  emailConsent: boolean;
  smsConsent: boolean;
  unsubscribedAt: string | null;
  smsStoppedAt: string | null;
};

export type LeadEvent = {
  id: string;
  type: string;
  channel: string | null;
  title: string;
  body: string | null;
  occurredAt: string;
  meta: { delivery?: string; providerId?: string } | null;
};

export type PendingMessage = {
  id: string;
  channel: string;
  sendAt: string;
  sequenceName: string;
};

export type LeadEnrollment = {
  status: string;
  currentStep: number;
  sequence: { name: string };
};

/** Detail payload rendered by the lead drawer. */
export type LeadDetail = Omit<Lead, "enrollments"> & {
  events: LeadEvent[];
  pendingMessages: PendingMessage[];
  enrollments: LeadEnrollment[];
};

type ConsentFields = {
  email: string | null;
  phone: string | null;
  emailConsent: boolean;
  smsConsent: boolean;
  unsubscribedAt: string | null;
  smsStoppedAt: string | null;
};

/** Consent gate: can we email this lead? */
export function canEmailLead(lead: ConsentFields | undefined): boolean {
  return Boolean(lead?.email) && Boolean(lead?.emailConsent) && !lead?.unsubscribedAt;
}

/** Consent gate: can we text this lead? */
export function canSmsLead(lead: ConsentFields | undefined): boolean {
  return Boolean(lead?.phone) && Boolean(lead?.smsConsent) && !lead?.smsStoppedAt;
}
