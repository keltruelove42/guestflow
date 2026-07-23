import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { getTouchpointAnalytics } from "@guestflow/core";
import { getSession } from "@/lib/auth";

/**
 * GET /api/v1/dashboard/touchpoints — Growth/Enterprise analytics:
 * open rates, reply rates, code redemptions and direct-booking conversions
 * by touchpoint (sequence + campaign).
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await prisma.org.findUniqueOrThrow({
    where: { id: session.orgId },
    select: { plan: true },
  });
  if (org.plan !== "GROWTH" && org.plan !== "ENTERPRISE") {
    return NextResponse.json(
      { error: "Touchpoint analytics is included with the Growth plan." },
      { status: 403 },
    );
  }

  const analytics = await getTouchpointAnalytics(session.orgId);
  return NextResponse.json(analytics);
}
