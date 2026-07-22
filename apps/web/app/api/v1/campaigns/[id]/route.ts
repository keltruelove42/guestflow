import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { createCampaignSchema } from "@guestflow/shared";
import { serializeCampaign, updateCampaign, endCampaign } from "@guestflow/core";
import { getSession } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaign = await prisma.campaign.findFirst({
    where: { id: params.id, orgId: session.orgId },
    include: { property: { select: { id: true, name: true } } },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(serializeCampaign(campaign));
}

const patchSchema = createCampaignSchema.partial();

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid campaign update" }, { status: 400 });
  }

  try {
    const updated = await updateCampaign(params.id, session.orgId, parsed.data);
    return NextResponse.json(serializeCampaign(updated));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    const status = message === "Campaign not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const ended = await endCampaign(params.id, session.orgId);
    return NextResponse.json(serializeCampaign(ended));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not end campaign";
    const status = message === "Campaign not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
