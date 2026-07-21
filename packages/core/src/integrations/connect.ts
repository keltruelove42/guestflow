import { prisma } from "@guestflow/db";
import { Prisma } from "@guestflow/db";
import { encryptJson } from "../crypto/credentials";
import { getProviderMeta } from "./catalog";
import { readIntegrationCredentials, verifyProviderCredentials } from "./verify";
import { refreshHostfullyTokens } from "./oauth";

export async function connectWithCredentials(opts: {
  orgId: string;
  provider: string;
  credentials: Record<string, unknown>;
  config?: Record<string, unknown> | null;
  skipVerify?: boolean;
}) {
  const meta = getProviderMeta(opts.provider);
  if (!meta) throw new Error(`Unknown provider: ${opts.provider}`);
  if (meta.auth === "oauth") {
    throw new Error("Use OAuth connect for this provider");
  }

  // Validate required fields
  for (const field of meta.fields) {
    if (field.required && !String(opts.credentials[field.key] ?? "").trim()) {
      throw new Error(`${field.label} is required`);
    }
  }

  if (!opts.skipVerify) {
    const check = await verifyProviderCredentials(opts.provider, opts.credentials);
    if (!check.ok) throw new Error(check.error);
  }

  const encrypted = encryptJson(opts.credentials) as Prisma.InputJsonValue;
  const config =
    opts.config == null
      ? undefined
      : (opts.config as Prisma.InputJsonValue);

  return prisma.integration.upsert({
    where: {
      orgId_provider: { orgId: opts.orgId, provider: opts.provider },
    },
    create: {
      orgId: opts.orgId,
      provider: opts.provider,
      status: "CONNECTED",
      credentials: encrypted,
      config,
      isDemo: false,
      lastSyncAt: new Date(),
      lastError: null,
    },
    update: {
      status: "CONNECTED",
      credentials: encrypted,
      config,
      isDemo: false,
      lastSyncAt: new Date(),
      lastError: null,
    },
  });
}

export async function connectOAuthTokens(opts: {
  orgId: string;
  provider: string;
  tokens: Record<string, unknown>;
  config?: Record<string, unknown> | null;
}) {
  const encrypted = encryptJson(opts.tokens) as Prisma.InputJsonValue;
  const config =
    opts.config == null
      ? undefined
      : (opts.config as Prisma.InputJsonValue);
  return prisma.integration.upsert({
    where: {
      orgId_provider: { orgId: opts.orgId, provider: opts.provider },
    },
    create: {
      orgId: opts.orgId,
      provider: opts.provider,
      status: "CONNECTED",
      credentials: encrypted,
      config,
      isDemo: false,
      lastSyncAt: new Date(),
      lastError: null,
    },
    update: {
      status: "CONNECTED",
      credentials: encrypted,
      config,
      isDemo: false,
      lastSyncAt: new Date(),
      lastError: null,
    },
  });
}

export async function disconnectIntegration(orgId: string, provider: string) {
  return prisma.integration.upsert({
    where: { orgId_provider: { orgId, provider } },
    create: {
      orgId,
      provider,
      status: "DISCONNECTED",
      credentials: undefined,
      isDemo: false,
    },
    update: {
      status: "DISCONNECTED",
      credentials: Prisma.DbNull,
      lastSyncAt: null,
      lastError: null,
      isDemo: false,
    },
  });
}

/** Run a light sync / health check for a connected integration. */
export async function syncIntegration(orgId: string, provider: string) {
  const row = await prisma.integration.findUnique({
    where: { orgId_provider: { orgId, provider } },
  });
  if (!row || row.status !== "CONNECTED") {
    throw new Error("Integration is not connected");
  }

  const creds = readIntegrationCredentials(row.credentials);
  if (!creds || row.isDemo) {
    // Demo / mock sync — just bump timestamp
    return prisma.integration.update({
      where: { id: row.id },
      data: { lastSyncAt: new Date(), lastError: null },
    });
  }

  try {
    if (provider === "hostfully") {
      const { HostfullyPmsProvider } = await import("./hostfully");
      let hostfullyCreds = creds as {
        apiKey?: string;
        accessToken?: string;
        refreshToken?: string;
        agencyUid?: string;
        oauth?: boolean;
      };
      if (hostfullyCreds.oauth && hostfullyCreds.refreshToken) {
        // Access tokens last 24h and refresh tokens rotate — refresh
        // before every sync and persist the new pair immediately.
        const fresh = await refreshHostfullyTokens(hostfullyCreds.refreshToken);
        hostfullyCreds = { ...hostfullyCreds, ...fresh };
        await prisma.integration.update({
          where: { id: row.id },
          data: { credentials: encryptJson(hostfullyCreds) as Prisma.InputJsonValue },
        });
      }
      const pms = new HostfullyPmsProvider(hostfullyCreds);
      await pms.syncInquiries(new Date(Date.now() - 7 * 864e5));
    } else if (provider === "hostaway") {
      const { HostawayPmsProvider } = await import("./hostaway");
      const pms = new HostawayPmsProvider(
        creds as { accountId: string; clientSecret: string },
      );
      await pms.syncInquiries(new Date(Date.now() - 7 * 864e5));
    } else if (provider === "twilio" || provider === "klaviyo" || provider === "lodgify" || provider === "ownerrez" || provider === "stayfi") {
      const check = await verifyProviderCredentials(provider, creds);
      if (!check.ok) throw new Error(check.error);
    } else if (provider === "meta") {
      const token = String(creds.accessToken ?? "");
      if (!token) throw new Error("Missing Meta access token — reconnect");
      const res = await fetch(
        `https://graph.facebook.com/v21.0/me?access_token=${encodeURIComponent(token)}`,
      );
      if (!res.ok) throw new Error("Meta token invalid — reconnect");
    }

    return prisma.integration.update({
      where: { id: row.id },
      data: { lastSyncAt: new Date(), lastError: null, status: "CONNECTED" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return prisma.integration.update({
      where: { id: row.id },
      data: { lastError: message, status: "ERROR" },
    });
  }
}


