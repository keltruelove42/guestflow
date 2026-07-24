import { prisma } from "@guestflow/db";
import { getAppointmentTypes } from "@guestflow/shared";

/**
 * AI Data Extract — read a lead's messy inbound text (replies, notes, capture
 * body) and pull structured fields the CRM can use: a one-line summary, the
 * service/interest, urgency, budget, timeframe, party size, and useful tags.
 * Applies the safe bits to the lead (timeframe, party size, tags) and writes
 * the summary as a note. Everything else is returned for the UI to show.
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-5";

export function isExtractConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type ExtractedFields = {
  summary: string;
  interest: string | null;
  urgency: "low" | "medium" | "high" | null;
  budget: string | null;
  timeframe: string | null;
  partySize: string | null;
  tags: string[];
};

export type ExtractResult = {
  fields: ExtractedFields;
  applied: { timeframe: boolean; partySize: boolean; tagsAdded: string[]; noteAdded: boolean };
};

export async function extractLeadFields(orgId: string, leadId: string): Promise<ExtractResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Data extract is not configured (ANTHROPIC_API_KEY).");

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, orgId },
    select: {
      name: true,
      tags: true,
      travelDates: true,
      partySize: true,
      org: { select: { vertical: true } },
      events: {
        where: { type: { in: ["REPLIED", "CAPTURED", "MANUAL_MESSAGE"] } },
        orderBy: { occurredAt: "desc" },
        take: 12,
        select: { type: true, body: true },
      },
      notes: { orderBy: { createdAt: "desc" }, take: 5, select: { text: true } },
    },
  });
  if (!lead) throw new Error("Lead not found");

  const material = [
    ...lead.events.filter((e) => e.body).map((e) => `${e.type}: ${e.body}`),
    ...lead.notes.map((n) => `NOTE: ${n.text}`),
  ]
    .join("\n")
    .slice(0, 4000);

  if (!material.trim()) {
    throw new Error("Nothing to extract yet — this lead has no messages or notes.");
  }

  const vertical = lead.org.vertical.toLowerCase();
  const services = getAppointmentTypes(lead.org.vertical)
    .map((t) => t.label)
    .join(", ");

  const prompt = [
    `You extract structured CRM fields from a ${vertical} lead's messages. Be conservative — use null when unknown; never invent facts.`,
    services ? `Typical services: ${services}.` : "",
    "",
    "Messages & notes (newest first):",
    material,
    "",
    'Respond with ONLY JSON: {"summary": string (one sentence), "interest": string|null (what they want), "urgency": "low"|"medium"|"high"|null, "budget": string|null, "timeframe": string|null (dates/when), "partySize": string|null (group size / #units if relevant), "tags": string[] (0-4 short lowercase labels like "urgent","financing","repeat")}',
  ].join("\n");

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
  if (!res.ok) throw new Error(`Extract request failed (${res.status})`);
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.find((b) => b.type === "text")?.text ?? "";

  const raw = jsonFrom(text);
  if (!raw) throw new Error("Couldn't read the lead's messages — try again.");

  const fields: ExtractedFields = {
    summary: str(raw.summary) ?? "",
    interest: str(raw.interest),
    urgency: ["low", "medium", "high"].includes(String(raw.urgency))
      ? (String(raw.urgency) as ExtractedFields["urgency"])
      : null,
    budget: str(raw.budget),
    timeframe: str(raw.timeframe),
    partySize: str(raw.partySize),
    tags: Array.isArray(raw.tags)
      ? raw.tags.map((t) => String(t).trim().toLowerCase().slice(0, 24)).filter(Boolean).slice(0, 4)
      : [],
  };

  // Apply the safe, structured bits.
  const newTags = fields.tags.filter((t) => !lead.tags.includes(t));
  const setTimeframe = fields.timeframe && !lead.travelDates;
  const setPartySize = fields.partySize && !lead.partySize;

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      ...(setTimeframe ? { travelDates: fields.timeframe } : {}),
      ...(setPartySize ? { partySize: fields.partySize } : {}),
      ...(newTags.length ? { tags: [...lead.tags, ...newTags] } : {}),
    },
  });

  let noteAdded = false;
  if (fields.summary) {
    await prisma.note.create({
      data: { orgId, leadId, text: `✨ AI summary: ${fields.summary}` },
    });
    noteAdded = true;
  }

  return {
    fields,
    applied: {
      timeframe: Boolean(setTimeframe),
      partySize: Boolean(setPartySize),
      tagsAdded: newTags,
      noteAdded,
    },
  };
}

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

function str(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, 300) : null;
}
