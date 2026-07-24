-- Migration 009 — Missed-call text-back (lead engine)
-- Run in Neon SQL Editor against `neondb`. Additive + idempotent.

ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "missedCallEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "voiceForwardPhone" TEXT;
ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "missedCallText" TEXT;

ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'PHONE';
ALTER TYPE "LeadEventType" ADD VALUE IF NOT EXISTS 'MISSED_CALL';
