-- Migration 005 — Email verification (signup CAPTCHA needs no schema change)
-- Run in Neon SQL Editor against `neondb`. Additive + idempotent.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt"    TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifyHash"    TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifyExpires" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_emailVerifyHash_idx" ON "User"("emailVerifyHash");

-- Backfill: treat every EXISTING user as already verified, so verification is
-- only required for NEW signups (no one is retroactively blocked from sending).
UPDATE "User" SET "emailVerifiedAt" = NOW() WHERE "emailVerifiedAt" IS NULL;
