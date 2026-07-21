import { NextResponse } from "next/server";
import { serializeCampaign, setCampaignStatus } from "@guestflow/core";
import { getSession } from "@/lib/auth";

type Ctx = { params: { id: string } };

export async function POST(_req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const campaign = await setCampaignStatus(params.id, session.orgId, "PAUSED");
    return NextResponse.json(serializeCampaign(campaign));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pause failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
