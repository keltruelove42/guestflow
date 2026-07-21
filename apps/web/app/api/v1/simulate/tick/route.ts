import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { tick } from "@guestflow/core";
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await prisma.org.findUniqueOrThrow({ where: { id: session.orgId } });
  if (org.mode !== "DEMO") {
    return NextResponse.json({ error: "Simulator is DEMO-only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const advanceMinutes = Number(body.advanceMinutes ?? 0);

  if (advanceMinutes > 0) {
    const cutoff = new Date(Date.now() + advanceMinutes * 60_000);
    // Pull pending messages forward so tick can send them
    await prisma.scheduledMessage.updateMany({
      where: {
        orgId: session.orgId,
        status: "PENDING",
        sendAt: { lte: cutoff },
      },
      data: { sendAt: new Date() },
    });
  }

  const result = await tick({ orgId: session.orgId, now: new Date() });
  return NextResponse.json(result);
}
