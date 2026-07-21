import { NextResponse } from "next/server";
import { launchCampaign, serializeCampaign } from "@guestflow/core";
import { getSession } from "@/lib/auth";

type Ctx = { params: { id: string } };

export async function POST(_req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const campaign = await launchCampaign(params.id, session.orgId);
    return NextResponse.json(serializeCampaign(campaign));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Launch failed";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
