export const OrgMode = {
  DEMO: "DEMO",
  LIVE: "LIVE",
} as const;
export type OrgMode = (typeof OrgMode)[keyof typeof OrgMode];

export const Role = {
  OWNER: "OWNER",
  MEMBER: "MEMBER",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const PropertyType = {
  SHORT_TERM: "SHORT_TERM",
  LONG_TERM: "LONG_TERM",
  BOTH: "BOTH",
} as const;
export type PropertyType = (typeof PropertyType)[keyof typeof PropertyType];

export const LeadSource = {
  META: "META",
  TIKTOK: "TIKTOK",
  PINTEREST: "PINTEREST",
  DIRECT_SITE: "DIRECT_SITE",
  WIFI: "WIFI",
  MANUAL: "MANUAL",
  IMPORT: "IMPORT",
} as const;
export type LeadSource = (typeof LeadSource)[keyof typeof LeadSource];

export const Stage = {
  NEW: "NEW",
  CONTACTED: "CONTACTED",
  ENGAGED: "ENGAGED",
  QUOTED: "QUOTED",
  BOOKED: "BOOKED",
  LOST: "LOST",
} as const;
export type Stage = (typeof Stage)[keyof typeof Stage];

export const LeadEventType = {
  CAPTURED: "CAPTURED",
  INQUIRY_STARTED: "INQUIRY_STARTED",
  INQUIRY_ABANDONED: "INQUIRY_ABANDONED",
  EMAIL_SENT: "EMAIL_SENT",
  SMS_SENT: "SMS_SENT",
  EMAIL_SCHEDULED_SKIPPED: "EMAIL_SCHEDULED_SKIPPED",
  REPLIED: "REPLIED",
  AI_REPLY_SENT: "AI_REPLY_SENT",
  MANUAL_MESSAGE: "MANUAL_MESSAGE",
  QUOTE_SENT: "QUOTE_SENT",
  BOOKED: "BOOKED",
  LOST_MARKED: "LOST_MARKED",
  STAGE_CHANGED: "STAGE_CHANGED",
  ENROLLED: "ENROLLED",
  SEQUENCE_PAUSED: "SEQUENCE_PAUSED",
  SEQUENCE_STOPPED: "SEQUENCE_STOPPED",
  SEQUENCE_COMPLETED: "SEQUENCE_COMPLETED",
  NOTE_ADDED: "NOTE_ADDED",
  IMPORTED: "IMPORTED",
  OPTED_OUT: "OPTED_OUT",
  CALL_DUE: "CALL_DUE",
} as const;
export type LeadEventType = (typeof LeadEventType)[keyof typeof LeadEventType];

export const Channel = {
  EMAIL: "EMAIL",
  SMS: "SMS",
  CALL: "CALL",
} as const;
export type Channel = (typeof Channel)[keyof typeof Channel];

export const AdPlatform = {
  META: "META",
  TIKTOK: "TIKTOK",
  PINTEREST: "PINTEREST",
} as const;
export type AdPlatform = (typeof AdPlatform)[keyof typeof AdPlatform];

export const CampaignStatus = {
  DRAFT: "DRAFT",
  IN_REVIEW: "IN_REVIEW",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  ENDED: "ENDED",
} as const;
export type CampaignStatus = (typeof CampaignStatus)[keyof typeof CampaignStatus];

export const SequenceTrigger = {
  AD_LEAD_CAPTURED: "AD_LEAD_CAPTURED",
  INQUIRY_ABANDONED: "INQUIRY_ABANDONED",
  QUOTE_UNACCEPTED_48H: "QUOTE_UNACCEPTED_48H",
  CHECKOUT_PLUS_90D: "CHECKOUT_PLUS_90D",
  MANUAL_ONLY: "MANUAL_ONLY",
} as const;
export type SequenceTrigger = (typeof SequenceTrigger)[keyof typeof SequenceTrigger];

export const EnrollmentStatus = {
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  STOPPED: "STOPPED",
  COMPLETED: "COMPLETED",
} as const;
export type EnrollmentStatus = (typeof EnrollmentStatus)[keyof typeof EnrollmentStatus];

export const ScheduledStatus = {
  PENDING: "PENDING",
  SENT: "SENT",
  SKIPPED: "SKIPPED",
  CANCELED: "CANCELED",
  FAILED: "FAILED",
} as const;
export type ScheduledStatus = (typeof ScheduledStatus)[keyof typeof ScheduledStatus];

export const IntegrationStatus = {
  DISCONNECTED: "DISCONNECTED",
  CONNECTED: "CONNECTED",
  ERROR: "ERROR",
} as const;
export type IntegrationStatus = (typeof IntegrationStatus)[keyof typeof IntegrationStatus];

export const STAGES = Object.values(Stage);
export const LEAD_SOURCES = Object.values(LeadSource);
