import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { sendManualMessage } from "@guestflow/core";
import { getSession } from "@/lib/auth";

type Ctx = { params: { id: string } };

/**
 * POST /api/v1/suggestions/[id] — resolve an AI-drafted reply.
 *   { action: "send", body? }  → send the (optionally edited) draft, mark SENT
 *   { action: "dismiss" }      → mark DISMISSED
 */
export async function POST(req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const suggestion = await prisma.aiSuggestion.findFirst({
    where: { id: params.id, orgId: session.orgId, status: "PENDING" },
  });
  if (!suggestion) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { action?: string; body?: string };

  if (body.action === "dismiss") {
    await prisma.aiSuggestion.update({
      where: { id: suggestion.id },
      data: { status: "DISMISSED" },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "send") {
    const text = String(body.body ?? suggestion.draft).trim();
    if (!text) return NextResponse.json({ error: "Message is empty" }, { status: 400 });
    try {
      await sendManualMessage({
        orgId: session.orgId,
        leadId: suggestion.leadId,
        channel: suggestion.channel === "SMS" ? "SMS" : "EMAIL",
        body: text,
        viaAi: true,
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Send failed" },
        { status: 400 },
      );
    }
    await prisma.aiSuggestion.update({
      where: { id: suggestion.id },
      data: { status: "SENT", draft: text },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
