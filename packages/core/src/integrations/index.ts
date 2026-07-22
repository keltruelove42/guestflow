import { prisma, type OrgMode } from "@guestflow/db";
import { MockAdsProvider } from "./mockAds";
import { LoggingEmailSender, LoggingSmsSender, MockPmsProvider } from "./mocks";
import { ResendEmailSender, resendConfigured } from "./resend";
import {
  TwilioSmsSender,
  parseTwilioCredentials,
  twilioCredsFromEnv,
} from "./twilio";
import { readIntegrationCredentials } from "./verify";
import { HostfullyPmsProvider } from "./hostfully";
import { HostawayPmsProvider } from "./hostaway";
import type { AdsProvider, EmailSender, PmsProvider, SmsSender } from "./types";

const adsCache = new Map<string, AdsProvider>();

export async function getOrgMode(orgId: string): Promise<OrgMode> {
  const org = await prisma.org.findUniqueOrThrow({ where: { id: orgId } });
  return org.mode;
}

/**
 * Live delivery when org is LIVE, or SEND_MODE=live (docs/01 override for local testing).
 * SEND_MODE=log forces logging mocks even in LIVE.
 */
export function wantsLiveDelivery(mode: OrgMode): boolean {
  const flag = process.env.SEND_MODE?.trim().toLowerCase();
  if (flag === "log" || flag === "demo") return false;
  if (flag === "live") return true;
  return mode === "LIVE";
}

/** Prefer live adapters when the org has real (non-demo) credentials stored. */
function hasLiveCredentials(integration: {
  status: string;
  isDemo: boolean;
  credentials: unknown;
} | null): boolean {
  if (!integration || integration.status !== "CONNECTED" || integration.isDemo) {
    return false;
  }
  return Boolean(readIntegrationCredentials(integration.credentials));
}

export async function getAdsProvider(
  orgId: string,
  platform: "META" | "TIKTOK" | "PINTEREST",
): Promise<AdsProvider> {
  const key = `${orgId}:${platform}`;
  const mode = await getOrgMode(orgId);
  const integration = await prisma.integration.findUnique({
    where: { orgId_provider: { orgId, provider: platform.toLowerCase() } },
  });

  // Live Marketing API campaign create lands fully in M6 — use mock for create/metrics
  // until dedicated live ads classes ship. Connected OAuth still enables lead fetch later.
  if (
    mode === "DEMO" &&
    !hasLiveCredentials(integration) &&
    process.env.SEND_MODE?.trim().toLowerCase() !== "live"
  ) {
    if (!adsCache.has(key)) adsCache.set(key, new MockAdsProvider());
    return adsCache.get(key)!;
  }
  if (!adsCache.has(key)) adsCache.set(key, new MockAdsProvider());
  return adsCache.get(key)!;
}

export async function getPmsProviders(orgId: string): Promise<PmsProvider[]> {
  const mode = await getOrgMode(orgId);
  const connected = await prisma.integration.findMany({
    where: {
      orgId,
      status: { in: ["CONNECTED", "ERROR"] },
      provider: { in: ["hostfully", "hostaway", "ownerrez", "lodgify"] },
    },
  });

  const liveForce = process.env.SEND_MODE?.trim().toLowerCase() === "live";
  const useLive = mode === "LIVE" || liveForce;

  if ((!useLive && connected.every((c) => c.isDemo || !c.credentials)) || connected.length === 0) {
    if (mode === "DEMO") return [new MockPmsProvider("hostfully")];
    if (connected.length === 0) return [new MockPmsProvider("hostfully")];
  }

  const providers: PmsProvider[] = [];
  for (const row of connected) {
    const creds = readIntegrationCredentials<Record<string, unknown>>(row.credentials);
    if (!creds || row.isDemo) {
      providers.push(new MockPmsProvider(row.provider));
      continue;
    }
    if (row.provider === "hostfully") {
      providers.push(
        new HostfullyPmsProvider({
          apiKey: String(creds.apiKey ?? ""),
          agencyUid: creds.agencyUid ? String(creds.agencyUid) : undefined,
        }),
      );
    } else if (row.provider === "hostaway") {
      providers.push(
        new HostawayPmsProvider({
          accountId: String(creds.accountId ?? ""),
          clientSecret: String(creds.clientSecret ?? ""),
        }),
      );
    } else {
      // OwnerRez / Lodgify: credentials stored; live sync coming soon → mock for pipeline demos
      providers.push(new MockPmsProvider(row.provider));
    }
  }
  return providers.length ? providers : [new MockPmsProvider("hostfully")];
}

export async function getEmailSender(orgId: string): Promise<EmailSender> {
  const mode = await getOrgMode(orgId);
  if (wantsLiveDelivery(mode) && resendConfigured()) {
    return new ResendEmailSender(
      process.env.RESEND_API_KEY!.trim(),
      process.env.EMAIL_FROM?.trim() || "LeadCoda <onboarding@resend.dev>",
    );
  }
  return new LoggingEmailSender();
}

export async function getSmsSender(orgId: string): Promise<SmsSender> {
  const mode = await getOrgMode(orgId);
  const integration = await prisma.integration.findUnique({
    where: { orgId_provider: { orgId, provider: "twilio" } },
  });

  // Use Twilio whenever real credentials exist (even in DEMO) so Connect "just works"
  const fromIntegration =
    integration?.status === "CONNECTED" && !integration.isDemo
      ? parseTwilioCredentials(readIntegrationCredentials(integration.credentials))
      : null;

  if (fromIntegration) return new TwilioSmsSender(fromIntegration);

  if (wantsLiveDelivery(mode)) {
    const envCreds = twilioCredsFromEnv();
    if (envCreds) return new TwilioSmsSender(envCreds);
  }
  return new LoggingSmsSender();
}

/** Snapshot of whether outbound will hit Resend/Twilio or the logging mock. */
export async function getMessagingDeliveryStatus(orgId: string) {
  const mode = await getOrgMode(orgId);
  const live = wantsLiveDelivery(mode);
  const emailLive = live && resendConfigured();

  const integration = await prisma.integration.findUnique({
    where: { orgId_provider: { orgId, provider: "twilio" } },
  });
  const fromIntegration =
    integration?.status === "CONNECTED" && !integration.isDemo
      ? parseTwilioCredentials(readIntegrationCredentials(integration.credentials))
      : null;
  const smsLive = Boolean(fromIntegration ?? (live ? twilioCredsFromEnv() : null));

  return {
    orgMode: mode,
    sendMode: process.env.SEND_MODE?.trim().toLowerCase() || null,
    email: emailLive ? ("live" as const) : ("log" as const),
    sms: smsLive ? ("live" as const) : ("log" as const),
    emailFrom: process.env.EMAIL_FROM?.trim() || null,
  };
}

export * from "./types";
export * from "./catalog";
export * from "./connect";
export * from "./oauth";
export * from "./verify";
export { MockAdsProvider } from "./mockAds";
export { MockPmsProvider, LoggingEmailSender, LoggingSmsSender } from "./mocks";
export { ResendEmailSender, resendConfigured } from "./resend";
export {
  TwilioSmsSender,
  twilioCredsFromEnv,
  parseTwilioCredentials,
} from "./twilio";
export { HostfullyPmsProvider } from "./hostfully";
export { HostawayPmsProvider } from "./hostaway";
