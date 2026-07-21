import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { getSession } from "@/lib/auth";

type Ctx = { params: { provider: string } };

/** Demo connect — marks CONNECTED without real OAuth (live providers land in M6). */
export async function POST(_req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const provider = params.provider.toLowerCase();
  const integration = await prisma.integration.upsert({
    where: {
      orgId_provider: { orgId: session.orgId, provider },
    },
    create: {
      orgId: session.orgId,
      provider,
      status: "CONNECTED",
      isDemo: false,
      lastSyncAt: new Date(),
    },
    update: {
      status: "CONNECTED",
      isDemo: false,
      lastSyncAt: new Date(),
      lastError: null,
    },
  });

  return NextResponse.json(integration);
}
