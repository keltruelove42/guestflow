-- Migration 006 — AI reply/booking agent
-- Run in Neon SQL Editor against `neondb`. Additive + idempotent.

ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "aiAgentMode" TEXT NOT NULL DEFAULT 'OFF';

CREATE TABLE IF NOT EXISTS "AiSuggestion" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "draft" TEXT NOT NULL,
    "rationale" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "bookedAppointmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiSuggestion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AiSuggestion_orgId_status_idx" ON "AiSuggestion"("orgId", "status");
CREATE INDEX IF NOT EXISTS "AiSuggestion_leadId_status_idx" ON "AiSuggestion"("leadId", "status");
