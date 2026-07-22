import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { stripeConfigured } from "@/lib/stripe";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await prisma.org.findUniqueOrThrow({
    where: { id: session.orgId },
    select: { plan: true, stripeCustomerId: true, stripeSubscriptionId: true },
  });
  return NextResponse.json({
    plan: org.plan,
    hasSubscription: Boolean(org.stripeSubscriptionId),
    configured: stripeConfigured(),
  });
}
