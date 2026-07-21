import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { getSession } from "@/lib/auth";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaign = await prisma.campaign.findFirst({
    where: { id: params.id, orgId: session.orgId },
    include: { property: { select: { name: true } } },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fields = Array.isArray(campaign.leadForm)
    ? (campaign.leadForm as Array<{ key: string; label: string; required: boolean }>)
    : [];

  return NextResponse.json({
    propertyName: campaign.property?.name ?? "Your property",
    campaignName: campaign.name,
    fields,
    consentCopy:
      "By submitting, you agree to be contacted about this property by email or text. Msg/data rates may apply. Reply STOP to opt out of texts.",
  });
}
