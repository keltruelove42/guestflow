import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { createCampaignSchema } from "@guestflow/shared";
import { createCampaign, serializeCampaign } from "@guestflow/core";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const platform = searchParams.get("platform");
  const propertyId = searchParams.get("propertyId") ?? searchParams.get("property");

  const campaigns = await prisma.campaign.findMany({
    where: {
      orgId: session.orgId,
      ...(status ? { status: status.toUpperCase() as never } : {}),
      ...(platform ? { platform: platform.toUpperCase() as never } : {}),
      ...(propertyId && propertyId !== "all" ? { propertyId } : {}),
    },
    include: { property: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(campaigns.map(serializeCampaign));
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().formErrors.join(", ") || "Invalid campaign" },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const campaign = await createCampaign({
    orgId: session.orgId,
    platform: data.platform,
    name: data.name,
    propertyId: data.propertyId,
    dailyBudgetCents: data.dailyBudgetCents,
    audience: data.audience,
    leadForm: data.leadForm,
    autoEnrollSequenceId: data.autoEnrollSequenceId,
    isDemo: false,
  });

  return NextResponse.json(serializeCampaign(campaign), { status: 201 });
}
