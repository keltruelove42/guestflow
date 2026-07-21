import { prisma, type OrgMode } from "@guestflow/db";
import { MockAdsProvider } from "./mockAds";
import { LoggingEmailSender, LoggingSmsSender, MockPmsProvider } from "./mocks";
import { ResendEmailSender, resendConfigured } from "./resend";
import {
  TwilioSmsSender,
  parseTwilioCredentials,
  twilioCredsFromEnv,
} from "./twilio";
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

export async function getAdsProvider(
  orgId: string,
  platform: "META" | "TIKTOK" | "PINTEREST",
): Promise<AdsProvider> {
  const key = `${orgId}:${platform}`;
  const mode = await getOrgMode(orgId);
  const integration = await prisma.integration.findUnique({
    where: { orgId_provider: { orgId, provider: platform.toLowerCase() } },
  });
  // Live providers land in M6; until then always mock
  if (mode === "DEMO" || !integration || integration.status !== "CONNECTED") {
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
      status: "CONNECTED",
      provider: { in: ["hostfully", "hostaway", "ownerrez", "lodgify"] },
    },
  });
  if (mode === "DEMO" || connected.length === 0) {
    return [new MockPmsProvider("hostfully")];
  }
  return connected.map((i) => new MockPmsProvider(i.provider));
}

export async function getEmailSender(orgId: string): Promise<EmailSender> {
  const mode = await getOrgMode(orgId);
  if (wantsLiveDelivery(mode) && resendConfigured()) {
    return new ResendEmailSender(
      process.env.RESEND_API_KEY!.trim(),
      process.env.EMAIL_FROM?.trim() || "GuestFlow <onboarding@resend.dev>",
    );
  }
  return new LoggingEmailSender();
}

export async function getSmsSender(orgId: string): Promise<SmsSender> {
  const mode = await getOrgMode(orgId);
  if (!wantsLiveDelivery(mode)) return new LoggingSmsSender();

  const integration = await prisma.integration.findUnique({
    where: { orgId_provider: { orgId, provider: "twilio" } },
  });
  const fromIntegration =
    integration?.status === "CONNECTED"
      ? parseTwilioCredentials(integration.credentials)
      : null;
  const creds = fromIntegration ?? twilioCredsFromEnv();
  if (creds) return new TwilioSmsSender(creds);
  return new LoggingSmsSender();
}

/** Snapshot of whether outbound will hit Resend/Twilio or the logging mock. */
export async function getMessagingDeliveryStatus(orgId: string) {
  const mode = await getOrgMode(orgId);
  const live = wantsLiveDelivery(mode);
  const emailLive = live && resendConfigured();

  let smsLive = false;
  if (live) {
    const integration = await prisma.integration.findUnique({
      where: { orgId_provider: { orgId, provider: "twilio" } },
    });
    const fromIntegration =
      integration?.status === "CONNECTED"
        ? parseTwilioCredentials(integration.credentials)
        : null;
    smsLive = Boolean(fromIntegration ?? twilioCredsFromEnv());
  }

  return {
    orgMode: mode,
    sendMode: process.env.SEND_MODE?.trim().toLowerCase() || null,
    email: emailLive ? ("live" as const) : ("log" as const),
    sms: smsLive ? ("live" as const) : ("log" as const),
    emailFrom: process.env.EMAIL_FROM?.trim() || null,
  };
}

export * from "./types";
export { MockAdsProvider } from "./mockAds";
export { MockPmsProvider, LoggingEmailSender, LoggingSmsSender } from "./mocks";
export { ResendEmailSender, resendConfigured } from "./resend";
export {
  TwilioSmsSender,
  twilioCredsFromEnv,
  parseTwilioCredentials,
} from "./twilio";
