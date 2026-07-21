import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await prisma.org.findUniqueOrThrow({
    where: { id: session.orgId },
    select: { id: true, name: true, mode: true },
  });

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { name: true },
  });

  const [
    ownProperties,
    ownSequences,
    ownCampaigns,
    ownLeads,
    connectedIntegrations,
    manualMessages,
  ] = await Promise.all([
    prisma.property.count({ where: { orgId: session.orgId, isDemo: false } }),
    prisma.sequence.count({ where: { orgId: session.orgId, isDemo: false } }),
    prisma.campaign.count({ where: { orgId: session.orgId, isDemo: false } }),
    prisma.lead.count({ where: { orgId: session.orgId, isDemo: false } }),
    prisma.integration.count({
      where: { orgId: session.orgId, status: "CONNECTED", isDemo: false },
    }),
    prisma.leadEvent.count({
      where: {
        orgId: session.orgId,
        type: { in: ["MANUAL_MESSAGE", "AI_REPLY_SENT"] },
      },
    }),
  ]);

  const firstName = user?.name?.trim().split(/\s+/)[0] ?? null;

  return NextResponse.json({
    orgId: org.id,
    orgName: org.name,
    orgMode: org.mode,
    firstName,
    ownProperties,
    ownSequences,
    ownCampaigns,
    ownLeads,
    connectedIntegrations,
    manualMessages,
  });
}
