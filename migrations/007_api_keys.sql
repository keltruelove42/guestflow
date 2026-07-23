-- Migration 007 — API keys for the MCP server / programmatic access
-- Run in Neon SQL Editor against `neondb`. Additive + idempotent.

CREATE TABLE IF NOT EXISTS "ApiKey" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_hash_key" ON "ApiKey"("hash");
CREATE INDEX IF NOT EXISTS "ApiKey_orgId_idx" ON "ApiKey"("orgId");
CREATE INDEX IF NOT EXISTS "ApiKey_hash_idx" ON "ApiKey"("hash");
ALTER TABLE "ApiKey" DROP CONSTRAINT IF EXISTS "ApiKey_orgId_fkey";
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
