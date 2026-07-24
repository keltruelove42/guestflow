import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { applyProviderEnrichment } from "@guestflow/core";

/**
 * Inbound enrichment webhook — an external provider (Clay, Apollo, etc.) POSTs
 * verified fields back here after running its data waterfall. Point the
 * provider at {APP_URL}/api/webhooks/enrich?leadId=… (LeadCoda includes this
 * callbackUrl when it pushes a lead out). Secured by INBOUND_EMAIL_SECRET when
 * set; the lead is resolved by leadId (query or body) or by email.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.INBOUND_EMAIL_SECRET?.trim();
  if (secret && url.searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const fields = (body.fields && typeof body.fields === "object" ? body.fields : body) as Record<
    string,
    unknown
  >;

  let leadId = url.searchParams.get("leadId") || String(body.leadId ?? "") || "";
  if (!leadId) {
    const email = String((fields.email as string) ?? body.email ?? "").trim().toLowerCase();
    if (email) {
      const lead = await prisma.lead.findFirst({ where: { email }, select: { id: true } });
      leadId = lead?.id ?? "";
    }
  }
  if (!leadId) return NextResponse.json({ ok: true, matched: false });

  await applyProviderEnrichment(leadId, fields);
  return NextResponse.json({ ok: true, matched: true });
}
