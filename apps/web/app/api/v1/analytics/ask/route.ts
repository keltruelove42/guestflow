import { NextResponse } from "next/server";
import { answerAnalyticsQuestion, isCopilotConfigured } from "@guestflow/core";
import { requireGrowth } from "@/lib/growth";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/v1/analytics/ask { question } — Analytics Copilot.
 * Turns a plain-English question into a report spec and runs it.
 */
export async function POST(req: Request) {
  const gate = await requireGrowth();
  if (!gate.ok) return gate.response;

  if (!isCopilotConfigured()) {
    return NextResponse.json(
      { error: "The Analytics Copilot needs an AI key (ANTHROPIC_API_KEY)." },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { question?: string };
  const question = String(body.question ?? "").trim().slice(0, 300);
  if (!question) return NextResponse.json({ error: "Ask a question." }, { status: 400 });

  try {
    const answer = await answerAnalyticsQuestion(gate.session.orgId, question);
    return NextResponse.json(answer);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Couldn't answer that." },
      { status: 400 },
    );
  }
}
