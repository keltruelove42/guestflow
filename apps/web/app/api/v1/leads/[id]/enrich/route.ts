import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { enrichLead, isEnrichmentConfigured } from "@guestflow/core";
import { requireGrowth } from "@/lib/growth";

export const runtime = "nodejs";
export const maxDuration = 30;

type Ctx = { params: { id: string } };

/** POST /api/v1/leads/[id]/enrich — run built-in enrichment (+ provider push). */
export async function POST(_req: Request, { params }: Ctx) {
  const gate = await requireGrowth();
  if (!gate.ok) return gate.response;

  if (!isEnrichmentConfigured()) {
    return NextResponse.json(
      { error: "Enrichment needs an AI key (ANTHROPIC_API_KEY)." },
      { status: 503 },
    );
  }

  const lead = await prisma.lead.findFirst({
    where: { id: params.id, orgId: gate.session.orgId },
    select: { id: true },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const enrichment = await enrichLead(gate.session.orgId, params.id);
    return NextResponse.json({ enrichment });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Enrichment failed" },
      { status: 400 },
    );
  }
}
