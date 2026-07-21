import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { getSession } from "@/lib/auth";

type Ctx = { params: { provider: string } };

export async function POST(_req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const provider = params.provider.toLowerCase();
  const integration = await prisma.integration.updateMany({
    where: { orgId: session.orgId, provider },
    data: {
      status: "DISCONNECTED",
      credentials: null,
      lastSyncAt: null,
    },
  });

  if (integration.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const row = await prisma.integration.findUnique({
    where: { orgId_provider: { orgId: session.orgId, provider } },
  });
  return NextResponse.json(row);
}
