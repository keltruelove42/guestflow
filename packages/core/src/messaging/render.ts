const MERGE_TAGS = [
  "first_name",
  "name",
  "property",
  "host_name",
  "business_name",
  "booking_link",
  "dates",
  "quote_link",
  "unsub_link",
  "season",
] as const;

export type MergeTag = (typeof MERGE_TAGS)[number];
export type MergeContext = Partial<Record<MergeTag, string>> &
  Record<string, string | undefined>;

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function firstName(fullName: string): string {
  const token = fullName.trim().split(/\s+/)[0];
  return token || "there";
}

export function seasonFor(date: Date): string {
  const m = date.getMonth(); // 0-based
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "fall";
  return "winter";
}

/**
 * Replace {{tags}} using the context. Any key present in ctx resolves
 * (built-ins AND org custom variables). Unknown tags render as "" so a
 * missing variable never sends a literal {{tag}} to a lead.
 */
export function renderMergeTags(
  template: string,
  ctx: MergeContext,
  opts?: { html?: boolean },
): string {
  return template
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
      const raw = ctx[key];
      if (raw == null) {
        if (!(MERGE_TAGS as readonly string[]).includes(key)) {
          console.warn(`[mergeTags] unknown tag {{${key}}} rendered empty`);
        }
        return "";
      }
      return opts?.html ? escapeHtml(raw) : raw;
    })
    // Collapse doubled spaces left behind by empty substitutions
    .replace(/ {2,}/g, " ");
}

export type RenderInput = {
  template: string;
  subject?: string | null;
  channel: "EMAIL" | "SMS" | "CALL";
  leadName: string;
  propertyName?: string | null;
  hostName?: string | null;
  travelDates?: string | null;
  quoteLink?: string | null;
  unsubLink: string;
  /** Org-level variable values: overrides for built-ins + custom tags */
  orgVariables?: Record<string, string> | null;
  now?: Date;
  appUrl?: string;
};

export type RenderedMessage = {
  subject: string | null;
  body: string;
  html?: string;
};

const UNSUB_FOOTER =
  "\n\n---\nPrefer not to hear from us? {{unsub_link}}";

/**
 * Render a sequence step. Enforces unsubscribe link on every EMAIL.
 * Merge order: built-in lead context < org variables (org values win for
 * business identity tags like host_name; lead-derived tags always win).
 */
export function renderMessage(input: RenderInput): RenderedMessage {
  const now = input.now ?? new Date();
  const org = sanitizeVariables(input.orgVariables);

  const ctx: MergeContext = {
    // Org custom variables first (lowest precedence)
    ...org,
    // Business identity: org value wins over caller default
    host_name: input.hostName?.trim() || org.host_name || "your host",
    business_name: org.business_name || input.hostName?.trim() || "our team",
    booking_link: org.booking_link || input.quoteLink || input.appUrl || "",
    // Lead-derived tags always win
    first_name: firstName(input.leadName),
    name: input.leadName.trim() || "there",
    property: input.propertyName?.trim() || org.property_fallback || "our place",
    dates: input.travelDates?.trim() || "your dates",
    quote_link: input.quoteLink || org.booking_link || input.appUrl || "",
    unsub_link: input.unsubLink,
    season: seasonFor(now),
  };

  let bodyTemplate = input.template;
  if (input.channel === "EMAIL") {
    if (!bodyTemplate.includes("{{unsub_link}}") && !bodyTemplate.includes(input.unsubLink)) {
      bodyTemplate += UNSUB_FOOTER;
    }
  }

  const body = renderMergeTags(bodyTemplate, ctx);
  const subject = input.subject
    ? renderMergeTags(input.subject, ctx)
    : null;

  if (input.channel === "CALL") {
    return { subject: subject ?? "Call task", body };
  }

  const smsBody =
    input.channel === "SMS" && body.length > 320
      ? `${body.slice(0, 317)}...`
      : body;

  if (input.channel === "EMAIL") {
    const htmlBody = renderMergeTags(bodyTemplate, ctx, { html: true }).replace(
      /\n/g,
      "<br/>",
    );
    return { subject: subject ?? "A note from your host", body: smsBody, html: htmlBody };
  }

  return { subject: null, body: smsBody };
}

/** Variable keys must be word-safe; values coerced to trimmed strings. */
export function sanitizeVariables(
  raw: unknown,
): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[a-z][a-z0-9_]{0,39}$/i.test(k)) continue;
    if (v == null) continue;
    const val = String(v).trim();
    if (!val) continue;
    out[k] = val.slice(0, 500);
  }
  return out;
}

/** Tags a user cannot override with org variables (lead/system derived). */
export const RESERVED_TAGS = [
  "first_name",
  "name",
  "dates",
  "quote_link",
  "unsub_link",
  "season",
  "property",
] as const;

export { MERGE_TAGS };
