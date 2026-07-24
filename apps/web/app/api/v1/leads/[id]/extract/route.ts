import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { extractLeadFields, isExtractConfigured } from "@guestflow/core";
import { requireGrowth } from "@/lib/growth";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: { id: string } };

/**
 * POST /api/v1/leads/[id]/extract — AI Data Extract.
 * Structures the lead's messy inbound text into fields + tags + a summary,
 * applies the safe bits, and returns what it found.
 */
export async function POST(_req: Request, { params }: Ctx) {
  const gate = await requireGrowth();
  if (!gate.ok) return gate.response;

  if (!isExtractConfigured()) {
    return NextResponse.json(
      { error: "AI extraction needs an AI key (ANTHROPIC_API_KEY)." },
      { status: 503 },
    );
  }

  const lead = await prisma.lead.findFirst({
    where: { id: params.id, orgId: gate.session.orgId },
    select: { id: true },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const result = await extractLeadFields(gate.session.orgId, params.id);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Extraction failed" },
      { status: 400 },
    );
  }
}
