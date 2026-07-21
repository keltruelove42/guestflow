import { NextResponse } from "next/server";
import { disconnectIntegration, getProviderMeta } from "@guestflow/core";
import { getSession } from "@/lib/auth";

type Ctx = { params: { provider: string } };

export async function POST(_req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const provider = params.provider.toLowerCase();
  if (!getProviderMeta(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const integration = await disconnectIntegration(session.orgId, provider);
  return NextResponse.json({
    id: integration.id,
    provider: integration.provider,
    status: integration.status,
  });
}
