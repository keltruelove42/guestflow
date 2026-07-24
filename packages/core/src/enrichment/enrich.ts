import { prisma, Prisma } from "@guestflow/db";
import { analyzeEmailDomain } from "./domain";

/**
 * Lead enrichment. Two layers, merged into Lead.enrichment:
 *   1. Built-in — deterministic domain analysis + a conservative Claude
 *      inference pass (company, industry, business-vs-personal, talking points).
 *      Always available; no external provider.
 *   2. External — an outbound webhook (e.g. a Clay table's webhook source) that
 *      runs a real data waterfall and posts verified fields back to
 *      /api/webhooks/enrich, which calls applyProviderEnrichment().
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-5";

export function isEnrichmentConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type Enrichment = {
  company: string | null;
  domain: string | null;
  isBusinessEmail: boolean;
  industry: string | null;
  role: string | null;
  location: string | null;
  linkedin: string | null;
  summary: string | null;
  talkingPoints: string[];
  /** Which layers contributed. */
  sources: string[];
  /** Verified fields returned by an external provider, kept raw. */
  provider?: Record<string, unknown> | null;
  inferred: boolean;
};

function jsonFrom(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1];
  const braced = text.match(/\{[\s\S]*\}/)?.[0];
  for (const c of [fenced, braced, text]) {
    if (!c) continue;
    try {
      return JSON.parse(c) as Record<string, unknown>;
    } catch {
      /* next */
    }
  }
  return null;
}
const str = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, 200) : null;
};

/** Built-in enrichment: domain analysis + a conservative AI inference pass. */
export async function enrichLead(orgId: string, leadId: string): Promise<Enrichment> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, orgId },
    select: {
      name: true,
      email: true,
      phone: true,
      address: true,
      source: true,
      enrichment: true,
      org: { select: { vertical: true, enrichWebhookUrl: true } },
    },
  });
  if (!lead) throw new Error("Lead not found");

  const dom = analyzeEmailDomain(lead.email);
  const prior = (lead.enrichment as Enrichment | null) ?? null;

  let ai: Record<string, unknown> = {};
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    const prompt = [
      `Infer background on a ${lead.org.vertical.toLowerCase()} business lead from the little we know. Be conservative — use null when you can't reasonably infer; never fabricate specific facts (no made-up phone numbers, exact titles, or addresses).`,
      "",
      `Name: ${lead.name}`,
      lead.email ? `Email: ${lead.email}` : null,
      dom.domain ? `Email domain: ${dom.domain} (${dom.isBusinessEmail ? "business" : "personal/free"})` : null,
      lead.address ? `Address: ${lead.address}` : null,
      "",
      'Respond ONLY JSON: {"company": string|null, "industry": string|null, "role": string|null (likely role/title if a business email), "location": string|null (only if strongly implied), "summary": string (one neutral sentence about who this lead likely is), "talkingPoints": string[] (0-3 short, tactful outreach angles based only on what is known)}',
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const res = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
          max_tokens: 500,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
        ai = jsonFrom(data.content?.find((b) => b.type === "text")?.text ?? "") ?? {};
      }
    } catch {
      /* inference is best-effort */
    }
  }

  const enrichment: Enrichment = {
    company: str(ai.company) ?? dom.companyGuess ?? prior?.company ?? null,
    domain: dom.domain ?? prior?.domain ?? null,
    isBusinessEmail: dom.isBusinessEmail,
    industry: str(ai.industry) ?? prior?.industry ?? null,
    role: str(ai.role) ?? prior?.role ?? null,
    location: str(ai.location) ?? prior?.location ?? null,
    linkedin: prior?.linkedin ?? null,
    summary: str(ai.summary) ?? prior?.summary ?? null,
    talkingPoints: Array.isArray(ai.talkingPoints)
      ? ai.talkingPoints.map((t) => String(t).slice(0, 120)).filter(Boolean).slice(0, 3)
      : (prior?.talkingPoints ?? []),
    sources: Array.from(new Set([...(prior?.sources ?? []), "domain", ...(apiKey ? ["ai"] : [])])),
    provider: prior?.provider ?? null,
    inferred: true,
  };

  await saveEnrichment(orgId, leadId, enrichment, "Lead enriched (AI)");

  // Kick off external enrichment if a provider webhook is configured.
  if (lead.org.enrichWebhookUrl) {
    void pushToProvider(orgId, leadId, lead.org.enrichWebhookUrl).catch(() => {});
  }

  return enrichment;
}

async function saveEnrichment(
  orgId: string,
  leadId: string,
  enrichment: Enrichment,
  eventTitle: string,
): Promise<void> {
  await prisma.lead.update({
    where: { id: leadId },
    data: { enrichment: enrichment as unknown as Prisma.InputJsonValue, enrichedAt: new Date() },
  });
  await prisma.leadEvent.create({
    data: {
      orgId,
      leadId,
      type: "IMPORTED",
      title: eventTitle,
      body: enrichment.summary ?? null,
      occurredAt: new Date(),
      meta: { enrichment: true },
    },
  });
}

/** POST the lead's identity to the configured provider webhook (e.g. Clay). */
async function pushToProvider(orgId: string, leadId: string, url: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { name: true, email: true, phone: true },
  });
  if (!lead) return;
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  // Carry the shared secret in the callback so the provider's write-back
  // passes the inbound webhook's auth check.
  const secret = process.env.INBOUND_EMAIL_SECRET?.trim();
  const callbackUrl =
    `${appUrl}/api/webhooks/enrich?leadId=${leadId}` +
    (secret ? `&secret=${encodeURIComponent(secret)}` : "");
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      leadId,
      orgId,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      // Where the provider should POST enriched results back to.
      callbackUrl,
    }),
  });
}

/**
 * Merge verified fields from an external provider (Clay etc.) into a lead's
 * enrichment. `fields` is the provider's flat payload; common keys are mapped,
 * everything is retained under `provider`.
 */
export async function applyProviderEnrichment(
  leadId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { orgId: true, enrichment: true },
  });
  if (!lead) return;
  const prior = (lead.enrichment as Enrichment | null) ?? null;

  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = fields[k];
      if (typeof v === "string" && v.trim()) return v.trim().slice(0, 200);
    }
    return null;
  };

  const enrichment: Enrichment = {
    company: pick("company", "companyName", "organization") ?? prior?.company ?? null,
    domain: pick("domain", "companyDomain") ?? prior?.domain ?? null,
    isBusinessEmail: prior?.isBusinessEmail ?? false,
    industry: pick("industry") ?? prior?.industry ?? null,
    role: pick("title", "role", "jobTitle") ?? prior?.role ?? null,
    location: pick("location", "city", "country") ?? prior?.location ?? null,
    linkedin: pick("linkedin", "linkedinUrl", "linkedin_url") ?? prior?.linkedin ?? null,
    summary: prior?.summary ?? null,
    talkingPoints: prior?.talkingPoints ?? [],
    sources: Array.from(new Set([...(prior?.sources ?? []), "provider"])),
    provider: fields,
    inferred: false, // provider data is verified
  };

  await saveEnrichment(lead.orgId, leadId, enrichment, "Lead enriched (provider)");
}
