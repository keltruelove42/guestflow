const MERGE_TAGS = [
  "first_name",
  "name",
  "property",
  "host_name",
  "dates",
  "quote_link",
  "unsub_link",
  "season",
] as const;

export type MergeTag = (typeof MERGE_TAGS)[number];
export type MergeContext = Partial<Record<MergeTag, string>>;

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

export function renderMergeTags(
  template: string,
  ctx: MergeContext,
  opts?: { html?: boolean },
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!(MERGE_TAGS as readonly string[]).includes(key)) {
      console.warn(`[mergeTags] unknown tag {{${key}}}`);
      return "";
    }
    const raw = ctx[key as MergeTag] ?? "";
    return opts?.html ? escapeHtml(raw) : raw;
  });
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
 */
export function renderMessage(input: RenderInput): RenderedMessage {
  const now = input.now ?? new Date();
  const ctx: MergeContext = {
    first_name: firstName(input.leadName),
    name: input.leadName.trim() || "there",
    property: input.propertyName?.trim() || "our place",
    host_name: input.hostName?.trim() || "your host",
    dates: input.travelDates?.trim() || "your dates",
    quote_link: input.quoteLink || input.appUrl || "",
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

export { MERGE_TAGS };
