import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { getSession } from "@/lib/auth";

/** Stripe customer portal: manage payment method, invoices, cancel. */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Billing not configured" }, { status: 400 });
  }

  const org = await prisma.org.findUniqueOrThrow({
    where: { id: session.orgId },
    select: { stripeCustomerId: true },
  });
  if (!org.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account yet" }, { status: 400 });
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  try {
    const portal = await getStripe().billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${appUrl}/billing`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not open the billing portal";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
