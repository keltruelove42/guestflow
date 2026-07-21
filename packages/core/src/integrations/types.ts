/** Provider interfaces — docs/08-integrations.md */

export type CapturedLead = {
  externalRef: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  travelDates?: string;
  partySize?: string;
  platform: "META" | "TIKTOK" | "PINTEREST";
  campaignExternalId?: string;
  consentText?: string;
  raw?: unknown;
};

export type PmsInquiry = {
  externalRef: string;
  propertyExternalId?: string;
  name: string;
  email?: string;
  phone?: string;
  dates?: string;
  partySize?: string;
  startedAt: Date;
  completedBooking: boolean;
};

export type PmsBooking = {
  externalRef: string;
  propertyExternalId?: string;
  name?: string;
  email?: string;
  phone?: string;
  amountCents?: number;
  bookedAt: Date;
  checkoutAt?: Date;
  inquiryExternalRef?: string;
};

export type CampaignInput = {
  name: string;
  dailyBudgetCents: number;
  audience: Record<string, unknown>;
  leadForm: Array<{ key: string; label: string; required: boolean }>;
  propertyExternalId?: string;
};

export interface AdsProvider {
  createCampaign(
    c: CampaignInput,
  ): Promise<{ externalId: string; status: "IN_REVIEW" | "ACTIVE" }>;
  setStatus(externalId: string, status: "ACTIVE" | "PAUSED"): Promise<void>;
  syncMetrics(externalId: string): Promise<{
    spendCents: number;
    impressions: number;
    clicks: number;
    leadsCount: number;
  }>;
  fetchLead(platformLeadId: string): Promise<CapturedLead>;
}

export interface PmsProvider {
  readonly name: string;
  syncInquiries(since: Date): Promise<PmsInquiry[]>;
  syncBookings(since: Date): Promise<PmsBooking[]>;
}

export type OutboundEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  headers?: Record<string, string>;
};

export type OutboundSms = {
  to: string;
  body: string;
};

export interface EmailSender {
  send(msg: OutboundEmail): Promise<{ providerId: string }>;
}

export interface SmsSender {
  send(msg: OutboundSms): Promise<{ providerId: string }>;
}
