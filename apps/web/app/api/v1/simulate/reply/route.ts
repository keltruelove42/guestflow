import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { recordInbound } from "@guestflow/core";
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await prisma.org.findUniqueOrThrow({ where: { id: session.orgId } });
  if (org.mode !== "DEMO") {
    return NextResponse.json({ error: "Simulator is DEMO-only" }, { status: 403 });
  }

  const body = await req.json();
  const leadId = body.leadId as string;
  const text = (body.text as string) ?? "Thanks! Is the dock private?";
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, orgId: session.orgId },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await recordInbound({ leadId, text, channel: "EMAIL" });
  const updated = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  return NextResponse.json({ lead: updated, ...result });
}
