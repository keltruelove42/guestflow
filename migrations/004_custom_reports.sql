-- Migration 004 — Custom report builder (Growth tier)
-- Run in Neon SQL Editor against `neondb`. Additive + idempotent; safe to
-- run twice. No existing data touched.

CREATE TABLE IF NOT EXISTS "SavedReport" (
    "id"        TEXT NOT NULL,
    "orgId"     TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "spec"      JSONB NOT NULL,
    "position"  INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SavedReport_orgId_position_idx"
    ON "SavedReport"("orgId", "position");

ALTER TABLE "SavedReport" DROP CONSTRAINT IF EXISTS "SavedReport_orgId_fkey";
ALTER TABLE "SavedReport" ADD CONSTRAINT "SavedReport_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
