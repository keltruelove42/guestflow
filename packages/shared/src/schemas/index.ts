import { z } from "zod";
import {
  AdPlatform,
  CampaignStatus,
  Channel,
  LeadSource,
  PropertyType,
  SequenceTrigger,
  Stage,
} from "../constants/enums";

export const createLeadSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  travelDates: z.string().optional().nullable(),
  partySize: z.string().optional().nullable(),
  source: z.nativeEnum(LeadSource).default(LeadSource.MANUAL),
  propertyId: z.string().optional().nullable(),
  campaignId: z.string().optional().nullable(),
  emailConsent: z.boolean().optional(),
  smsConsent: z.boolean().optional(),
  autoEnrollSequenceId: z.string().optional().nullable(),
});
export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const patchLeadSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  travelDates: z.string().optional().nullable(),
  partySize: z.string().optional().nullable(),
  propertyId: z.string().optional().nullable(),
  emailConsent: z.boolean().optional(),
  smsConsent: z.boolean().optional(),
  needsAttention: z.boolean().optional(),
});
export type PatchLeadInput = z.infer<typeof patchLeadSchema>;

export const stageChangeSchema = z.object({
  stage: z.nativeEnum(Stage),
});

export const createPropertySchema = z.object({
  name: z.string().min(1),
  location: z.string().optional().nullable(),
  bedrooms: z.number().int().optional().nullable(),
  type: z.nativeEnum(PropertyType).default(PropertyType.SHORT_TERM),
  photoUrl: z.string().optional().nullable(),
  imageUrl: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().url().nullable().optional(),
  ),
  description: z.string().max(1000).optional().nullable(),
  directBookingUrl: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().url().nullable().optional(),
  ),
  knowledgeBase: z.string().optional().nullable(),
});
export type CreatePropertyInput = z.infer<typeof createPropertySchema>;

export const createCampaignSchema = z.object({
  platform: z.nativeEnum(AdPlatform),
  name: z.string().min(1),
  propertyId: z.string().optional().nullable(),
  dailyBudgetCents: z.number().int().positive(),
  audience: z.record(z.unknown()),
  leadForm: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      required: z.boolean(),
    }),
  ),
  autoEnrollSequenceId: z.string().optional().nullable(),
});
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const createSequenceSchema = z.object({
  name: z.string().min(1),
  trigger: z.nativeEnum(SequenceTrigger),
  active: z.boolean().default(true),
  steps: z.array(
    z.object({
      delayMinutes: z.number().int().min(0),
      channel: z.nativeEnum(Channel),
      subject: z.string().optional().nullable(),
      body: z.string().min(1),
    }),
  ).min(1),
});
export type CreateSequenceInput = z.infer<typeof createSequenceSchema>;

export const sendMessageSchema = z.object({
  channel: z.nativeEnum(Channel),
  subject: z.string().optional(),
  body: z.string().min(1),
  viaAi: z.boolean().optional(),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const loginDemoSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  vertical: z
    .enum([
      "RENTALS",
      "TRADES",
      "BEAUTY",
      "DEALERSHIPS",
      "SAAS",
      "ECOMMERCE",
      "REALESTATE",
      "HOTELS",
    ])
    .optional(),
});
export type LoginDemoInput = z.infer<typeof loginDemoSchema>;

export const importLeadsSchema = z.object({
  rows: z
    .array(
      z.object({
        name: z.string().min(1),
        email: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
        travelDates: z.string().optional().nullable(),
        partySize: z.string().optional().nullable(),
        propertyName: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      }),
    )
    .min(1)
    .max(500),
  emailConsent: z.boolean(),
  smsConsent: z.boolean(),
});
export type ImportLeadsInput = z.infer<typeof importLeadsSchema>;

export const enrollLeadSchema = z.object({
  sequenceId: z.string().min(1),
});
export type EnrollLeadInput = z.infer<typeof enrollLeadSchema>;

export { CampaignStatus };
