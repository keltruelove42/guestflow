import { createHash, randomBytes } from "node:crypto";

/**
 * Opaque verification/reset tokens. The raw token goes in the email link; only
 * its SHA-256 hash is stored, so a database leak can't be used to verify or
 * reset accounts.
 */

export function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24h
