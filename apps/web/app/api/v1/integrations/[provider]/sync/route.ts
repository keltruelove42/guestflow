import { NextResponse } from "next/server";
import { getProviderMeta, syncIntegration } from "@guestflow/core";
import { getSession } from "@/lib/auth";

type Ctx = { params: { provider: string } };

export async function POST(_req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const provider = params.provider.toLowerCase();
  if (!getProviderMeta(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  try {
    const integration = await syncIntegration(session.orgId, provider);
    return NextResponse.json({
      id: integration.id,
      provider: integration.provider,
      status: integration.status,
      lastSyncAt: integration.lastSyncAt,
      lastError: integration.lastError,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
