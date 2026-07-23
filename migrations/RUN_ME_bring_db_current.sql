-- ============================================================================
-- LeadCoda — bring the production database fully current (idempotent)
-- Run this ONCE in the Neon SQL Editor (neondb). Safe to run repeatedly.
-- It creates anything missing from this whole build and touches nothing that
-- already exists. No existing data is modified except the verification backfill.
-- ============================================================================

-- ── Phase 1: Brand settings ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "BrandSettings" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#1a1a2e',
    "accentColor" TEXT NOT NULL DEFAULT '#4f46e5',
    "businessName" TEXT,
    "font" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BrandSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BrandSettings_orgId_key" ON "BrandSettings"("orgId");
ALTER TABLE "BrandSettings" DROP CONSTRAINT IF EXISTS "BrandSettings_orgId_fkey";
ALTER TABLE "BrandSettings" ADD CONSTRAINT "BrandSettings_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Optional hero photo per sequence (renders under the branded email header)
ALTER TABLE "Sequence" ADD COLUMN IF NOT EXISTS "heroPhotoUrl" TEXT;

-- ── Phase 2: AI-generated images ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "GeneratedImage" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sequenceId" TEXT,
    "prompt" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeneratedImage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GeneratedImage_orgId_createdAt_idx" ON "GeneratedImage"("orgId", "createdAt");
ALTER TABLE "GeneratedImage" DROP CONSTRAINT IF EXISTS "GeneratedImage_orgId_fkey";
ALTER TABLE "GeneratedImage" ADD CONSTRAINT "GeneratedImage_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Trials + analytics event types ─────────────────────────────────────────
ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
ALTER TYPE "LeadEventType" ADD VALUE IF NOT EXISTS 'EMAIL_OPENED';
ALTER TYPE "LeadEventType" ADD VALUE IF NOT EXISTS 'CODE_REDEEMED';

-- ── Custom report builder ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SavedReport" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spec" JSONB NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SavedReport_orgId_position_idx" ON "SavedReport"("orgId", "position");
ALTER TABLE "SavedReport" DROP CONSTRAINT IF EXISTS "SavedReport_orgId_fkey";
ALTER TABLE "SavedReport" ADD CONSTRAINT "SavedReport_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Email verification ─────────────────────────────────────────────────────
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt"    TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifyHash"    TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifyExpires" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "User_emailVerifyHash_idx" ON "User"("emailVerifyHash");
-- Backfill: existing users count as verified, so only NEW signups must verify.
UPDATE "User" SET "emailVerifiedAt" = NOW() WHERE "emailVerifiedAt" IS NULL;
