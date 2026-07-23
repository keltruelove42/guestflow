import { prisma } from "@guestflow/db";
import { firstName } from "../../messaging/render";
import {
  bookAppointment,
  checkAvailability,
  getBusinessContext,
} from "./tools";

/**
 * The AI reply/booking agent. Given an inbound lead message, it reads the
 * business context + conversation history and produces an on-brand reply,
 * using tools to check availability and actually book when the lead is ready.
 * Text-only model output; all side effects go through the audited tools.
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-5";
const MAX_TURNS = 6;

export type AgentResult = {
  reply: string;
  rationale: string;
  bookedAppointmentId: string | null;
  /** Agent wants a human to take over (complaint, refund, unsure, off-topic). */
  handoff: boolean;
  channel: "EMAIL" | "SMS";
};

export function isAgentConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const TOOLS = [
  {
    name: "check_availability",
    description:
      "List open appointment slots for the business over the next N days. Call this before offering times.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "number", description: "How many days ahead to look (default 10)." },
      },
    },
  },
  {
    name: "book_appointment",
    description:
      "Book an appointment for this lead at an exact slot start time you got from check_availability. Only call once the lead has clearly agreed to a specific time.",
    input_schema: {
      type: "object",
      properties: {
        startISO: { type: "string", description: "Slot start time in ISO 8601, from check_availability." },
      },
      required: ["startISO"],
    },
  },
  {
    name: "escalate_to_human",
    description:
      "Hand off to a human teammate when you cannot help confidently: complaints, refunds, legal/medical/financial specifics, pricing you weren't given, angry customers, or anything ambiguous or off-topic.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Short reason for the handoff." },
      },
      required: ["reason"],
    },
  },
] as const;

type AnthropicBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

async function callClaude(system: string, messages: unknown[]): Promise<{
  stopReason: string;
  blocks: AnthropicBlock[];
}> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
      max_tokens: 700,
      system,
      tools: TOOLS,
      messages,
    }),
  });
  if (!res.ok) {
    throw new Error(`Agent model call failed (${res.status})`);
  }
  const data = (await res.json()) as { stop_reason: string; content: AnthropicBlock[] };
  return { stopReason: data.stop_reason, blocks: data.content };
}

/** Pull the recent back-and-forth so the agent has conversation context. */
async function conversationHistory(orgId: string, leadId: string): Promise<string> {
  const events = await prisma.leadEvent.findMany({
    where: {
      orgId,
      leadId,
      type: { in: ["EMAIL_SENT", "SMS_SENT", "MANUAL_MESSAGE", "AI_REPLY_SENT", "REPLIED"] },
    },
    orderBy: { occurredAt: "desc" },
    take: 10,
    select: { type: true, body: true, occurredAt: true },
  });
  return events
    .reverse()
    .map((e) => {
      const who = e.type === "REPLIED" ? "Lead" : "Business";
      return `${who}: ${(e.body ?? "").slice(0, 500)}`;
    })
    .join("\n");
}

export async function runReplyAgent(input: {
  orgId: string;
  leadId: string;
  incomingText: string;
  channel: "EMAIL" | "SMS";
  now?: Date;
}): Promise<AgentResult> {
  if (!isAgentConfigured()) throw new Error("AI agent not configured (ANTHROPIC_API_KEY)");

  const ctx = await getBusinessContext(input.orgId, input.leadId);
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: input.leadId },
    select: { name: true },
  });
  const history = await conversationHistory(input.orgId, input.leadId);

  const factLines = Object.entries(ctx.facts)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const smsRule =
    input.channel === "SMS"
      ? "This is SMS: keep it under ~300 characters, warm and plain. No subject line."
      : "This is email: friendly and concise, a few short sentences.";

  const system = [
    `You are the front-desk assistant for ${ctx.businessName}, a ${ctx.vertical.toLowerCase()} business. You reply to a lead named ${firstName(lead.name)} on their behalf.`,
    ctx.offering ? `They asked about: ${ctx.offering}.` : null,
    "",
    "What you know about the business (never invent facts beyond this):",
    factLines || "- (no extra details provided)",
    "",
    ctx.bookingEnabled
      ? `Online booking is ON. Appointment types: ${ctx.appointmentTypes.map((t) => `${t.label} (${t.minutes}m)`).join(", ")}. Use check_availability to get real slots, offer 2-3, and once the lead picks one, call book_appointment with that exact startISO. Confirm the booking in your reply.`
      : "Online booking is OFF — do not promise to book; offer to have someone follow up.",
    "",
    "Rules:",
    "- Goal: answer helpfully and move the lead toward booking or a next step.",
    "- Only state pricing, policies, hours, or services that appear above. If asked something you don't know, say you'll check and escalate.",
    "- Never quote a price you weren't given. Never make guarantees.",
    "- If it's a complaint, refund, legal/medical/financial matter, an angry message, or ambiguous/off-topic, call escalate_to_human instead of guessing.",
    smsRule,
    "- Your final message is sent verbatim to the lead. Write only that message — no preamble, no quotes.",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  const messages: unknown[] = [
    {
      role: "user",
      content:
        (history ? `Conversation so far:\n${history}\n\n` : "") +
        `The lead just sent (${input.channel}): "${input.incomingText}"\n\nReply to them.`,
    },
  ];

  let bookedAppointmentId: string | null = null;
  let handoff = false;
  let handoffReason = "";

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const { stopReason, blocks } = await callClaude(system, messages);
    messages.push({ role: "assistant", content: blocks });

    if (stopReason !== "tool_use") {
      const text = blocks
        .filter((b): b is Extract<AnthropicBlock, { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return {
        reply: text || "Thanks for the message — someone from our team will follow up shortly.",
        rationale: handoff ? `Handoff: ${handoffReason}` : bookedAppointmentId ? "Booked an appointment." : "Answered the lead.",
        bookedAppointmentId,
        handoff,
        channel: input.channel,
      };
    }

    // Execute each requested tool and feed results back.
    const toolResults: AnthropicBlock[] = [];
    for (const block of blocks) {
      if (block.type !== "tool_use") continue;
      let content = "";
      try {
        if (block.name === "check_availability") {
          const days = Number((block.input as { days?: number }).days) || 10;
          const r = await checkAvailability(input.orgId, { days, now: input.now });
          content = r.enabled
            ? JSON.stringify(r.slots)
            : "Booking is not enabled for this business.";
        } else if (block.name === "book_appointment") {
          const startISO = String((block.input as { startISO?: string }).startISO ?? "");
          const r = await bookAppointment(input.orgId, input.leadId, { startISO, now: input.now });
          if (r.ok) {
            bookedAppointmentId = r.appointmentId;
            content = `Booked for ${r.label}.`;
          } else {
            content = `Could not book: ${r.reason}`;
          }
        } else if (block.name === "escalate_to_human") {
          handoff = true;
          handoffReason = String((block.input as { reason?: string }).reason ?? "unspecified");
          content = "Escalated to a human teammate. Write a brief holding reply to the lead.";
        } else {
          content = "Unknown tool.";
        }
      } catch (e) {
        content = `Tool error: ${e instanceof Error ? e.message : "failed"}`;
      }
      toolResults.push({ type: "tool_result", tool_use_id: block.id, content });
    }
    messages.push({ role: "user", content: toolResults });
  }

  // Ran out of turns — safe fallback.
  return {
    reply: "Thanks for reaching out! Someone from our team will get right back to you.",
    rationale: "Reached the reasoning limit; handed off.",
    bookedAppointmentId,
    handoff: true,
    channel: input.channel,
  };
}
