import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import {
  getStripe,
  stripeConfigured,
  PLAN_PRICING,
  type PaidPlan,
  type BillingInterval,
} from "@/lib/stripe";
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Billing is not configured yet. Set STRIPE_SECRET_KEY" },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    plan?: string;
    interval?: string;
  };
  const plan = String(body.plan ?? "").toUpperCase() as PaidPlan;
  const interval: BillingInterval = body.interval === "annual" ? "annual" : "monthly";
  if (!(plan in PLAN_PRICING)) {
    return NextResponse.json({ error: "Pick STARTER or GROWTH" }, { status: 400 });
  }

  const stripe = getStripe();
  const org = await prisma.org.findUniqueOrThrow({
    where: { id: session.orgId },
    include: { users: { take: 1, orderBy: { createdAt: "asc" } } },
  });

  let customerId = org.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: org.users[0]?.email ?? session.email,
      name: org.name,
      metadata: { orgId: org.id },
    });
    customerId = customer.id;
    await prisma.org.update({
      where: { id: org.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const pricing = PLAN_PRICING[plan];
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          product_data: {
            name: pricing.name,
            description:
              interval === "annual"
                ? "Flat workspace pricing, billed annually"
                : "Flat workspace pricing, billed monthly",
          },
          unit_amount: interval === "annual" ? pricing.annual : pricing.monthly,
          recurring: { interval: interval === "annual" ? "year" : "month" },
        },
      },
    ],
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { orgId: org.id, plan },
    },
    metadata: { orgId: org.id, plan },
    success_url: `${appUrl}/billing?status=success`,
    cancel_url: `${appUrl}/billing?status=cancelled`,
  });

  return NextResponse.json({ url: checkout.url });
}
