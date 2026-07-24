-- Migration 008 — Lead enrichment (Phase D)
-- Run in Neon SQL Editor against `neondb`. Additive + idempotent.

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "enrichment" JSONB;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "enrichedAt" TIMESTAMP(3);

ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "enrichAuto" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "enrichWebhookUrl" TEXT;
