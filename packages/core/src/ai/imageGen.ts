/**
 * Phase 2 — AI image generation (Growth/Enterprise only).
 *
 * Two-stage pipeline: Claude crafts an on-brand prompt from BrandSettings +
 * template/business context (Claude does not generate images itself), then a
 * separate image-generation provider renders it. Provider choice is isolated
 * here: currently OpenAI's gpt-image API (env OPENAI_API_KEY, optional
 * OPENAI_IMAGE_MODEL override). Swapping providers means changing only
 * `generateImage`.
 */

export type ImagePromptInput = {
  vertical: string;
  businessName?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  /** Sanitized org variables (services, pricing, policies…). */
  variables: Record<string, string>;
  sequence: { name: string; trigger: string };
  /** Subject/body of the sequence's first email step, for subject-matter context. */
  emailSubject?: string | null;
  emailBody?: string | null;
  /** Optional user guidance, e.g. "cozy cabin in winter". */
  instruction?: string | null;
};

/** Plan gate — checked before anything else. Free/base tiers only ever see manual upload. */
export function canGenerateImages(plan: string): boolean {
  return plan === "GROWTH" || plan === "ENTERPRISE";
}

export function isImageGenConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY && process.env.ANTHROPIC_API_KEY);
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";
const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-5";
const DEFAULT_IMAGE_MODEL = "gpt-image-1";

/**
 * Stage 1 — Claude builds the image prompt for brand consistency
 * (colors, tone, product context). Returns the prompt text.
 */
export async function buildImagePrompt(input: ImagePromptInput): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Image generation is not configured (missing ANTHROPIC_API_KEY)");

  const vars = Object.entries(input.variables)
    .slice(0, 20)
    .map(([k, v]) => `- ${k}: ${v.slice(0, 200)}`)
    .join("\n");

  const brief = [
    "Write a single prompt for an AI image generator to create a marketing hero photo for an email header. Respond with ONLY the prompt text, no preamble.",
    "",
    `Business: ${input.businessName ?? "a small business"} (industry: ${input.vertical})`,
    input.primaryColor || input.accentColor
      ? `Brand colors: primary ${input.primaryColor ?? "n/a"}, accent ${input.accentColor ?? "n/a"} — the image's palette should harmonize with these (subtle, not garish).`
      : null,
    vars ? `Business details:\n${vars}` : null,
    `The email this heads: sequence "${input.sequence.name}" (trigger: ${input.sequence.trigger}).`,
    input.emailSubject ? `Email subject: ${input.emailSubject}` : null,
    input.emailBody ? `Email opening: ${input.emailBody.slice(0, 300)}` : null,
    input.instruction ? `User's request: ${input.instruction}` : null,
    "",
    "Prompt requirements: photorealistic lifestyle/product photography style suited to the industry, warm and professional, landscape 3:2 composition with clear space, NO text, NO words, NO logos, NO watermarks in the image, no people's faces in close-up.",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? DEFAULT_CLAUDE_MODEL,
      max_tokens: 400,
      messages: [{ role: "user", content: brief }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Prompt generation failed (${res.status})`);
  }
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const prompt = data.content?.find((b) => b.type === "text")?.text?.trim();
  if (!prompt) throw new Error("Prompt generation returned an unexpected format");
  return prompt.slice(0, 2000);
}

/**
 * Stage 2 — render the prompt with the image provider.
 * Returns raw image bytes (PNG) for the caller to store in Blob.
 */
export async function generateImage(prompt: string): Promise<Uint8Array> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Image generation is not configured (missing OPENAI_API_KEY)");

  const res = await fetch(OPENAI_IMAGES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL,
      prompt,
      size: "1536x1024",
      n: 1,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Image generation failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    );
  }
  const data = (await res.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const first = data.data?.[0];
  if (first?.b64_json) {
    return Uint8Array.from(Buffer.from(first.b64_json, "base64"));
  }
  if (first?.url) {
    const img = await fetch(first.url);
    if (!img.ok) throw new Error("Failed to download generated image");
    return new Uint8Array(await img.arrayBuffer());
  }
  throw new Error("Image provider returned no image");
}
