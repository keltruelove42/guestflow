import type { SmsSender, OutboundSms } from "./types";

export type TwilioCreds = {
  /** Account SID (AC...) or an API Key SID (SK...) */
  accountSid: string;
  /** Auth Token (for AC...) or the API Key secret (for SK...) */
  authToken: string;
  fromNumber: string;
};

/**
 * Resolve the Basic-auth pair and the real Account SID.
 * Users can paste either their Account SID + Auth Token, or an API Key
 * (SK...) + secret; for API keys we look up the owning account.
 */
export async function resolveTwilioAuth(creds: {
  accountSid: string;
  authToken: string;
}): Promise<{ username: string; password: string; accountSid: string }> {
  const { accountSid, authToken } = creds;
  if (!accountSid.startsWith("SK")) {
    return { username: accountSid, password: authToken, accountSid };
  }
  const res = await fetch(
    "https://api.twilio.com/2010-04-01/Accounts.json?PageSize=1",
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      },
    },
  );
  if (!res.ok) throw new Error("Twilio rejected this API key");
  const data = (await res.json().catch(() => ({}))) as {
    accounts?: Array<{ sid?: string }>;
  };
  const acct = data.accounts?.[0]?.sid;
  if (!acct) throw new Error("Could not find the Twilio account for this API key");
  return { username: accountSid, password: authToken, accountSid: acct };
}

/** Live SMS via Twilio Messages API (docs/08). */
export class TwilioSmsSender implements SmsSender {
  constructor(private readonly creds: TwilioCreds) {}

  async send(msg: OutboundSms): Promise<{ providerId: string }> {
    const { fromNumber } = this.creds;
    const auth = await resolveTwilioAuth(this.creds);
    const url = `https://api.twilio.com/2010-04-01/Accounts/${auth.accountSid}/Messages.json`;
    const body = new URLSearchParams({
      To: msg.to,
      From: fromNumber,
      Body: msg.body,
    });

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const data = (await res.json().catch(() => ({}))) as {
      sid?: string;
      message?: string;
      error_message?: string;
    };

    if (!res.ok) {
      throw new Error(
        data.error_message ?? data.message ?? `Twilio error ${res.status}`,
      );
    }
    if (!data.sid) throw new Error("Twilio returned no message sid");
    return { providerId: data.sid };
  }
}

export function twilioCredsFromEnv(): TwilioCreds | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();
  if (!accountSid || !authToken || !fromNumber) return null;
  return { accountSid, authToken, fromNumber };
}

export function parseTwilioCredentials(raw: unknown): TwilioCreds | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const accountSid = String(o.accountSid ?? o.sid ?? "").trim();
  const authToken = String(o.authToken ?? o.token ?? "").trim();
  const fromNumber = String(o.fromNumber ?? o.from ?? "").trim();
  if (!accountSid || !authToken || !fromNumber) return null;
  return { accountSid, authToken, fromNumber };
}
