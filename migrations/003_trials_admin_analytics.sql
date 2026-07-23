-- Migration 003 — Trials, admin, analytics (feature/trials-admin-analytics)
-- Run in Neon SQL Editor against the `neondb` database. Additive + idempotent;
-- safe to run twice. No existing data is modified or deleted.

-- 1) 7-day trial clock (nullable; NULL = no expiry, so existing orgs keep working)
ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);

-- 2) New lead-event types for analytics (email opens + code redemptions)
ALTER TYPE "LeadEventType" ADD VALUE IF NOT EXISTS 'EMAIL_OPENED';
ALTER TYPE "LeadEventType" ADD VALUE IF NOT EXISTS 'CODE_REDEEMED';

-- Note: Booking."attributedSequenceId" already exists from an earlier migration;
-- this branch only starts populating it in code, so no column change is needed.

-- ── OPTIONAL ────────────────────────────────────────────────────────────────
-- Give every CURRENT trial workspace a fresh 7-day window from today. Skip this
-- if you'd rather existing trials stay unlimited (NULL) and only NEW signups get
-- the clock. Uncomment to run:
--
-- UPDATE "Org"
--    SET "trialEndsAt" = NOW() + INTERVAL '7 days'
--  WHERE "plan" = 'TRIAL' AND "trialEndsAt" IS NULL;
