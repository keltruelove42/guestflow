import { Channel } from "@guestflow/shared";

export type ChannelLead = {
  email: string | null;
  phone: string | null;
  emailConsent: boolean;
  smsConsent: boolean;
  unsubscribedAt: Date | null;
  smsStoppedAt: Date | null;
};

export type ChannelResolution =
  | { action: "SEND"; channel: "EMAIL" | "SMS" | "CALL"; fallbackFrom?: "EMAIL" | "SMS" }
  | { action: "SKIP"; reason: string };

export function emailOk(lead: ChannelLead): boolean {
  return Boolean(lead.email && lead.emailConsent && !lead.unsubscribedAt);
}

export function smsOk(lead: ChannelLead): boolean {
  return Boolean(lead.phone && lead.smsConsent && !lead.smsStoppedAt);
}

/**
 * Resolve send channel at send time with fallback.
 * CALL needs a phone number (host dials); no marketing-consent gate.
 * Never blocks — SKIP advances the enrollment.
 */
export function resolveChannel(
  stepChannel: "EMAIL" | "SMS" | "CALL",
  lead: ChannelLead,
): ChannelResolution {
  const canEmail = emailOk(lead);
  const canSms = smsOk(lead);

  if (stepChannel === Channel.CALL) {
    // DECISION: call tasks require a phone; no silent fallback (host needs a number to dial)
    if (lead.phone) return { action: "SEND", channel: "CALL" };
    return { action: "SKIP", reason: "No phone number for call task" };
  }

  if (stepChannel === Channel.EMAIL) {
    if (canEmail) return { action: "SEND", channel: "EMAIL" };
    if (canSms) return { action: "SEND", channel: "SMS", fallbackFrom: "EMAIL" };
    return { action: "SKIP", reason: "No consented channel available" };
  }

  if (canSms) return { action: "SEND", channel: "SMS" };
  if (canEmail) return { action: "SEND", channel: "EMAIL", fallbackFrom: "SMS" };
  return { action: "SKIP", reason: "No consented channel available" };
}

/** EMAIL→SMS: truncate to 300 chars. SMS→EMAIL: body + generic subject. */
export function rewriteForFallback(opts: {
  from: "EMAIL" | "SMS";
  to: "EMAIL" | "SMS" | "CALL";
  subject: string | null;
  body: string;
  propertyName: string;
}): { subject: string | null; body: string } {
  if (opts.to === "CALL") {
    return { subject: null, body: opts.body };
  }
  if (opts.from === "EMAIL" && opts.to === "SMS") {
    const truncated =
      opts.body.length > 300 ? `${opts.body.slice(0, 297)}...` : opts.body;
    return { subject: null, body: truncated };
  }
  if (opts.from === "SMS" && opts.to === "EMAIL") {
    return {
      subject: `A note about ${opts.propertyName}`,
      body: opts.body,
    };
  }
  return { subject: opts.subject, body: opts.body };
}
