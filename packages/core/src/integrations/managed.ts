import { prisma, Prisma } from "@guestflow/db";
import { encryptJson } from "../crypto/credentials";
import { readIntegrationCredentials } from "./verify";

/**
 * Managed (white-labeled) sending. LeadCoda holds ONE platform Resend
 * account and ONE platform Twilio account; customers get their own
 * sending domain and phone number provisioned under those accounts
 * without ever touching Resend or Twilio themselves.
 *
 * Platform env vars:
 *   PLATFORM_RESEND_API_KEY       - Resend key on LeadCoda's account
 *   PLATFORM_TWILIO_ACCOUNT_SID   - master AC... sid (upgraded account)
 *   PLATFORM_TWILIO_AUTH_TOKEN    - master auth token
 *
 * State is stored on Integration rows (hidden from the catalog grid):
 *   provider "managed_email": config { domainId, domain, fromLocal,
 *     fromName, records[], status: pending|verified|failed }
 *   provider "managed_sms": credentials { accountSid, authToken,
 *     fromNumber } (subaccount), config { businessName, a2pStatus, ... }
 */

export function platformResendKey(): string | null {
  return process.env.PLATFORM_RESEND_API_KEY?.trim() || null;
}

export function platformTwilioCreds(): { sid: string; token: string } | null {
  const sid = process.env.PLATFORM_TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.PLATFORM_TWILIO_AUTH_TOKEN?.trim();
  if (!sid || !token) return null;
  return { sid, token };
}

/** LeadCoda's SMS + Voice webhook URLs (with the shared secret) for a managed
 * Twilio number. Null when APP_URL isn't configured. */
export function leadcodaWebhookUrls(): { smsUrl: string; voiceUrl: string } | null {
  const appUrl = process.env.APP_URL?.trim();
  if (!appUrl) return null;
  const secret = process.env.INBOUND_EMAIL_SECRET?.trim();
  const qs = secret ? `?secret=${encodeURIComponent(secret)}` : "";
  return {
    smsUrl: `${appUrl}/api/webhooks/twilio/sms${qs}`,
    voiceUrl: `${appUrl}/api/webhooks/twilio/voice${qs}`,
  };
}

/** Reconfigure an existing managed number's SMS + Voice webhooks (for numbers
 * provisioned before auto-wiring, or after APP_URL/secret changes). */
export async function reconfigureManagedNumberWebhooks(orgId: string): Promise<boolean> {
  const hooks = leadcodaWebhookUrls();
  if (!hooks) return false;
  const row = await prisma.integration.findUnique({
    where: { orgId_provider: { orgId, provider: "managed_sms" } },
  });
  if (!row || row.status !== "CONNECTED") return false;
  const creds = readIntegrationCredentials(row.credentials) as {
    accountSid?: string;
    authToken?: string;
    fromNumber?: string;
  } | null;
  if (!creds?.accountSid || !creds.authToken || !creds.fromNumber) return false;

  // Find the number's SID in the subaccount, then update its webhooks.
  const listRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(creds.fromNumber)}`,
    { headers: { Authorization: twilioAuth(creds.accountSid, creds.authToken) } },
  );
  const list = (await listRes.json().catch(() => ({}))) as {
    incoming_phone_numbers?: Array<{ sid?: string }>;
  };
  const numSid = list.incoming_phone_numbers?.[0]?.sid;
  if (!numSid) return false;

  const upd = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/IncomingPhoneNumbers/${numSid}.json`,
    {
      method: "POST",
      headers: {
        Authorization: twilioAuth(creds.accountSid, creds.authToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        SmsUrl: hooks.smsUrl,
        SmsMethod: "POST",
        VoiceUrl: hooks.voiceUrl,
        VoiceMethod: "POST",
      }),
    },
  );
  return upd.ok;
}

export type DnsRecord = {
  record: string;
  name: string;
  type: string;
  value: string;
  status?: string;
};

type ManagedEmailConfig = {
  domainId: string;
  domain: string;
  fromLocal: string;
  fromName?: string;
  records: DnsRecord[];
  status: "pending" | "verified" | "failed";
};

function resendHeaders(key: string) {
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function saveManagedRow(opts: {
  orgId: string;
  provider: "managed_email" | "managed_sms";
  status: "CONNECTED" | "PENDING" | "ERROR";
  credentials?: Record<string, unknown> | null;
  config: Record<string, unknown>;
  lastError?: string | null;
}) {
  const encrypted = opts.credentials
    ? (encryptJson(opts.credentials) as Prisma.InputJsonValue)
    : undefined;
  const dbStatus = opts.status === "CONNECTED" ? "CONNECTED" : "DISCONNECTED";
  return prisma.integration.upsert({
    where: { orgId_provider: { orgId: opts.orgId, provider: opts.provider } },
    create: {
      orgId: opts.orgId,
      provider: opts.provider,
      status: dbStatus,
      credentials: encrypted,
      config: opts.config as Prisma.InputJsonValue,
      isDemo: false,
      lastError: opts.lastError ?? null,
      lastSyncAt: new Date(),
    },
    update: {
      status: dbStatus,
      ...(encrypted !== undefined ? { credentials: encrypted } : {}),
      config: opts.config as Prisma.InputJsonValue,
      isDemo: false,
      lastError: opts.lastError ?? null,
      lastSyncAt: new Date(),
    },
  });
}

function rowConfig<T>(row: { config: unknown } | null): T | null {
  if (!row?.config || typeof row.config !== "object") return null;
  return row.config as T;
}

/* ---------------- Managed email (Resend platform account) ---------------- */

export async function createManagedEmailDomain(opts: {
  orgId: string;
  domain: string;
  fromLocal?: string;
  fromName?: string;
}) {
  const key = platformResendKey();
  if (!key) {
    throw new Error(
      "Managed email is not configured yet (PLATFORM_RESEND_API_KEY missing)",
    );
  }
  const domain = opts.domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) || domain.includes("@")) {
    throw new Error("Enter a bare domain like yourbusiness.com");
  }
  const fromLocal = (opts.fromLocal?.trim() || "hello").toLowerCase();
  if (!/^[a-z0-9._-]+$/.test(fromLocal)) {
    throw new Error("From address can only contain letters, numbers, dots and dashes");
  }

  // Reuse an existing registration for the same domain if present
  const existingRow = await prisma.integration.findUnique({
    where: { orgId_provider: { orgId: opts.orgId, provider: "managed_email" } },
  });
  const existingCfg = rowConfig<ManagedEmailConfig>(existingRow);
  if (existingCfg?.domain === domain && existingCfg.domainId) {
    return refreshManagedEmail(opts.orgId);
  }

  const res = await fetch("https://api.resend.com/domains", {
    method: "POST",
    headers: resendHeaders(key),
    body: JSON.stringify({ name: domain }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    records?: DnsRecord[];
    message?: string;
    name?: string;
    status?: string;
  };

  // Domain may already exist on the platform account: find it
  let domainId = data.id;
  let records = data.records ?? [];
  let status: ManagedEmailConfig["status"] = "pending";
  if (!res.ok) {
    if (res.status === 409 || /already exists/i.test(data.message ?? "")) {
      const list = await fetch("https://api.resend.com/domains", {
        headers: resendHeaders(key),
      });
      const listData = (await list.json().catch(() => ({}))) as {
        data?: Array<{ id: string; name: string; status: string }>;
      };
      const found = listData.data?.find((d) => d.name.toLowerCase() === domain);
      if (!found) throw new Error(data.message ?? "Could not register domain");
      domainId = found.id;
      status = found.status === "verified" ? "verified" : "pending";
      const detail = await fetch(`https://api.resend.com/domains/${found.id}`, {
        headers: resendHeaders(key),
      });
      const detailData = (await detail.json().catch(() => ({}))) as {
        records?: DnsRecord[];
      };
      records = detailData.records ?? [];
    } else {
      throw new Error(data.message ?? `Resend error ${res.status}`);
    }
  }
  if (!domainId) throw new Error("Resend returned no domain id");

  const config: ManagedEmailConfig = {
    domainId,
    domain,
    fromLocal,
    fromName: opts.fromName?.trim() || undefined,
    records,
    status,
  };
  await saveManagedRow({
    orgId: opts.orgId,
    provider: "managed_email",
    status: status === "verified" ? "CONNECTED" : "PENDING",
    config,
  });
  return config;
}

/** Re-check verification with Resend; flips to live when DNS propagates. */
export async function refreshManagedEmail(orgId: string) {
  const key = platformResendKey();
  const row = await prisma.integration.findUnique({
    where: { orgId_provider: { orgId, provider: "managed_email" } },
  });
  const cfg = rowConfig<ManagedEmailConfig>(row);
  if (!key || !cfg?.domainId) return cfg;

  // Ask Resend to (re)verify, then read status + fresh records
  await fetch(`https://api.resend.com/domains/${cfg.domainId}/verify`, {
    method: "POST",
    headers: resendHeaders(key),
  }).catch(() => null);
  const res = await fetch(`https://api.resend.com/domains/${cfg.domainId}`, {
    headers: resendHeaders(key),
  });
  const data = (await res.json().catch(() => ({}))) as {
    status?: string;
    records?: DnsRecord[];
  };
  const status: ManagedEmailConfig["status"] =
    data.status === "verified"
      ? "verified"
      : data.status === "failed"
        ? "failed"
        : "pending";
  const next: ManagedEmailConfig = {
    ...cfg,
    records: data.records ?? cfg.records,
    status,
  };
  await saveManagedRow({
    orgId,
    provider: "managed_email",
    status: status === "verified" ? "CONNECTED" : "PENDING",
    config: next,
  });
  return next;
}

/** Live from-address when the org's managed domain is verified. */
export async function managedEmailFrom(orgId: string): Promise<{
  apiKey: string;
  from: string;
} | null> {
  const key = platformResendKey();
  if (!key) return null;
  const row = await prisma.integration.findUnique({
    where: { orgId_provider: { orgId, provider: "managed_email" } },
  });
  const cfg = rowConfig<ManagedEmailConfig>(row);
  if (!cfg || cfg.status !== "verified") return null;
  const email = `${cfg.fromLocal}@${cfg.domain}`;
  return { apiKey: key, from: cfg.fromName ? `${cfg.fromName} <${email}>` : email };
}

/* ---------------- Managed SMS (Twilio platform account) ---------------- */

export type ManagedSmsInput = {
  businessName: string;
  businessType: "sole_prop" | "llc" | "corporation" | "partnership" | "other";
  ein?: string;
  website?: string;
  address: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  areaCode?: string;
};

type ManagedSmsConfig = ManagedSmsInput & {
  subaccountSid: string;
  fromNumber: string;
  a2pStatus: "pending" | "submitted" | "approved";
};

function twilioAuth(sid: string, token: string) {
  return `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`;
}

/**
 * Provision managed texting: subaccount + local number under LeadCoda's
 * master Twilio account. Business info is stored for A2P registration.
 */
export async function provisionManagedSms(orgId: string, input: ManagedSmsInput) {
  const master = platformTwilioCreds();
  if (!master) {
    throw new Error(
      "Managed texting is not configured yet (PLATFORM_TWILIO_ACCOUNT_SID / PLATFORM_TWILIO_AUTH_TOKEN missing)",
    );
  }
  if (!input.businessName.trim()) throw new Error("Business name is required");
  if (!input.contactEmail.trim()) throw new Error("Contact email is required");

  // Already provisioned? Return as-is.
  const existing = await prisma.integration.findUnique({
    where: { orgId_provider: { orgId, provider: "managed_sms" } },
  });
  const existingCfg = rowConfig<ManagedSmsConfig>(existing);
  if (existingCfg?.fromNumber && existing?.status === "CONNECTED") {
    return existingCfg;
  }

  // 1) Subaccount
  const subRes = await fetch("https://api.twilio.com/2010-04-01/Accounts.json", {
    method: "POST",
    headers: {
      Authorization: twilioAuth(master.sid, master.token),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ FriendlyName: `leadcoda-${orgId}` }),
  });
  const sub = (await subRes.json().catch(() => ({}))) as {
    sid?: string;
    auth_token?: string;
    message?: string;
  };
  if (!subRes.ok || !sub.sid || !sub.auth_token) {
    throw new Error(
      sub.message ??
        "Could not create a Twilio subaccount. Trial Twilio accounts cannot create subaccounts, upgrade the platform account first",
    );
  }

  // 2) Find + buy a local SMS-capable number
  const searchParams = new URLSearchParams({ SmsEnabled: "true", PageSize: "1" });
  if (input.areaCode?.trim()) searchParams.set("AreaCode", input.areaCode.trim());
  const availRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sub.sid}/AvailablePhoneNumbers/US/Local.json?${searchParams}`,
    { headers: { Authorization: twilioAuth(sub.sid, sub.auth_token) } },
  );
  const avail = (await availRes.json().catch(() => ({}))) as {
    available_phone_numbers?: Array<{ phone_number?: string }>;
    message?: string;
  };
  const candidate = avail.available_phone_numbers?.[0]?.phone_number;
  if (!candidate) {
    throw new Error(
      avail.message ??
        `No numbers available${input.areaCode ? ` in area code ${input.areaCode}` : ""}. Try a different area code`,
    );
  }
  // Point the number's SMS + Voice webhooks at LeadCoda at purchase time, so
  // managed clients never touch Twilio (inbound replies + missed-call text-back
  // work out of the box).
  const buyBody = new URLSearchParams({ PhoneNumber: candidate });
  const hooks = leadcodaWebhookUrls();
  if (hooks) {
    buyBody.set("SmsUrl", hooks.smsUrl);
    buyBody.set("SmsMethod", "POST");
    buyBody.set("VoiceUrl", hooks.voiceUrl);
    buyBody.set("VoiceMethod", "POST");
  }
  const buyRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sub.sid}/IncomingPhoneNumbers.json`,
    {
      method: "POST",
      headers: {
        Authorization: twilioAuth(sub.sid, sub.auth_token),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: buyBody,
    },
  );
  const bought = (await buyRes.json().catch(() => ({}))) as {
    phone_number?: string;
    message?: string;
  };
  if (!buyRes.ok || !bought.phone_number) {
    throw new Error(bought.message ?? "Could not purchase a number");
  }

  const config: ManagedSmsConfig = {
    ...input,
    subaccountSid: sub.sid,
    fromNumber: bought.phone_number,
    a2pStatus: "pending",
  };
  await saveManagedRow({
    orgId,
    provider: "managed_sms",
    status: "CONNECTED",
    credentials: {
      accountSid: sub.sid,
      authToken: sub.auth_token,
      fromNumber: bought.phone_number,
    },
    config,
  });
  return config;
}

/** Twilio creds for the org's managed number, if provisioned. */
export async function managedSmsCreds(orgId: string): Promise<{
  accountSid: string;
  authToken: string;
  fromNumber: string;
} | null> {
  const row = await prisma.integration.findUnique({
    where: { orgId_provider: { orgId, provider: "managed_sms" } },
  });
  if (row?.status !== "CONNECTED" || row.isDemo) return null;
  const creds = readIntegrationCredentials(row.credentials) as {
    accountSid?: string;
    authToken?: string;
    fromNumber?: string;
  } | null;
  if (!creds?.accountSid || !creds.authToken || !creds.fromNumber) return null;
  return {
    accountSid: creds.accountSid,
    authToken: creds.authToken,
    fromNumber: creds.fromNumber,
  };
}

/** Combined status for the go-live wizard. */
export async function getManagedSendingStatus(orgId: string) {
  const [emailRow, smsRow] = await Promise.all([
    prisma.integration.findUnique({
      where: { orgId_provider: { orgId, provider: "managed_email" } },
    }),
    prisma.integration.findUnique({
      where: { orgId_provider: { orgId, provider: "managed_sms" } },
    }),
  ]);
  const email = rowConfig<ManagedEmailConfig>(emailRow);
  const sms = rowConfig<ManagedSmsConfig>(smsRow);
  return {
    emailConfigured: Boolean(platformResendKey()),
    smsConfigured: Boolean(platformTwilioCreds()),
    email: email
      ? {
          domain: email.domain,
          from: `${email.fromLocal}@${email.domain}`,
          fromName: email.fromName ?? null,
          status: email.status,
          records: email.records,
        }
      : null,
    sms: sms
      ? {
          fromNumber: sms.fromNumber,
          businessName: sms.businessName,
          a2pStatus: sms.a2pStatus,
        }
      : null,
  };
}
