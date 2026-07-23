import { prisma } from "@guestflow/db";
import { randomBytes } from "node:crypto";
import { hashToken } from "./tokens";

/**
 * Org API keys for the MCP server / programmatic access. The raw key is shown
 * once at creation; only its SHA-256 hash is stored. Format: `lc_live_<hex>`.
 */

export function generateApiKey(): { raw: string; hash: string; last4: string } {
  const raw = `lc_live_${randomBytes(24).toString("hex")}`;
  return { raw, hash: hashToken(raw), last4: raw.slice(-4) };
}

export type ApiKeyContext = { orgId: string; keyId: string };

/**
 * Resolve a raw API key to its org. Returns null when missing, unknown, or
 * revoked. Best-effort touches lastUsedAt.
 */
export async function resolveApiKey(raw: string | null | undefined): Promise<ApiKeyContext | null> {
  const value = (raw ?? "").trim();
  if (!value.startsWith("lc_live_")) return null;

  const key = await prisma.apiKey.findUnique({
    where: { hash: hashToken(value) },
    select: { id: true, orgId: true, revokedAt: true },
  });
  if (!key || key.revokedAt) return null;

  // Fire-and-forget usage stamp.
  prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { orgId: key.orgId, keyId: key.id };
}
