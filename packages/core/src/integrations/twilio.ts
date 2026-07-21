import type { SmsSender, OutboundSms } from "./types";

export type TwilioCreds = {
  accountSid: string;
  authToken: string;
  fromNumber: string;
};

/** Live SMS via Twilio Messages API (docs/08). */
export class TwilioSmsSender implements SmsSender {
  constructor(private readonly creds: TwilioCreds) {}

  async send(msg: OutboundSms): Promise<{ providerId: string }> {
    const { accountSid, authToken, fromNumber } = this.creds;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const body = new URLSearchParams({
      To: msg.to,
      From: fromNumber,
      Body: msg.body,
    });

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
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
