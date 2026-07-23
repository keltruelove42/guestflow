/**
 * "Rewrite with AI" for sequence templates — text only, no new UI surface.
 * Builds business context from data the app already collects (vertical,
 * org variables: business identity, services, pricing, policies) plus the
 * template being edited, and asks Claude to rewrite subject/body on-brand.
 */

export type RewriteInput = {
  channel: "EMAIL" | "SMS" | "CALL";
  subject?: string | null;
  body: string;
  /** Free-form guidance from the user, e.g. "shorter and friendlier". */
  instruction?: string | null;
  business: {
    vertical: string;
    businessName?: string | null;
    /** Sanitized org variables (services, pricing, policies, custom). */
    variables: Record<string, string>;
    /** Known merge tags the rewrite must preserve verbatim. */
    knownTags: readonly string[];
  };
  sequence?: { name: string; trigger: string } | null;
};

export type RewriteResult = { subject: string | null; body: string };

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-5";

export function isRewriteConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function buildPrompt(input: RewriteInput): string {
  const vars = Object.entries(input.business.variables)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  return [
    `Rewrite this ${input.channel === "SMS" ? "SMS" : input.channel === "CALL" ? "call script" : "email"} follow-up template so it is on-brand, clear, and conversion-focused.`,
    "",
    "Business context:",
    `- Industry vertical: ${input.business.vertical}`,
    input.business.businessName ? `- Business name: ${input.business.businessName}` : null,
    vars ? `Business variables (services, pricing, policies, identity):\n${vars}` : null,
    input.sequence
      ? `This template belongs to the sequence "${input.sequence.name}" (trigger: ${input.sequence.trigger}).`
      : null,
    "",
    "Hard rules:",
    `- Merge tags like {{first_name}} must be preserved EXACTLY as written (double curly braces, same tag names). Known tags: ${input.business.knownTags.map((t) => `{{${t}}}`).join(", ")}. Do not invent new tags.`,
    "- Keep {{unsub_link}} if present.",
    input.channel === "SMS"
      ? "- SMS: max ~300 characters, keep any '(Reply STOP to opt out)' compliance text."
      : null,
    "- Same language as the original. No emojis unless the original used them.",
    input.instruction ? `User guidance: ${input.instruction}` : null,
    "",
    "Current template:",
    input.subject ? `Subject: ${input.subject}` : "(no subject)",
    "Body:",
    input.body,
    "",
    'Respond with ONLY a JSON object: {"subject": string | null, "body": string}. Subject null for SMS.',
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

/**
 * Call Claude (text only) to rewrite subject/body. Throws with a
 * user-presentable message on configuration or API failure.
 */
export async function rewriteTemplate(input: RewriteInput): Promise<RewriteResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("AI rewrite is not configured (missing ANTHROPIC_API_KEY)");
  }

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: buildPrompt(input) }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `AI rewrite failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    );
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text =
    data.content?.find((b) => b.type === "text")?.text?.trim() ?? "";

  const parsed = parseRewriteJson(text);
  if (!parsed) throw new Error("AI rewrite returned an unexpected format");
  return parsed;
}

/** Tolerant JSON extraction (handles stray prose or code fences). */
export function parseRewriteJson(text: string): RewriteResult | null {
  const candidates = [text];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) candidates.unshift(fenced[1]);
  const braced = text.match(/\{[\s\S]*\}/);
  if (braced?.[0]) candidates.push(braced[0]);

  for (const c of candidates) {
    try {
      const obj = JSON.parse(c) as { subject?: unknown; body?: unknown };
      if (typeof obj.body === "string" && obj.body.trim()) {
        return {
          subject:
            typeof obj.subject === "string" && obj.subject.trim()
              ? obj.subject.trim()
              : null,
          body: obj.body,
        };
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}
