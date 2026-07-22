import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@guestflow/db";
import { getStripe, stripeConfigured } from "@/lib/stripe";

/**
 * Stripe webhook: keeps Org.plan in sync with the subscription.
 * Configure the endpoint in Stripe as {APP_URL}/api/v1/billing/webhook
 * with events: checkout.session.completed, customer.subscription.updated,
 * customer.subscription.deleted. Set STRIPE_WEBHOOK_SECRET.
 */
export async function POST(req: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Billing not configured" }, { status: 400 });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET missing" },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  const signature = req.headers.get("stripe-signature");
  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature ?? "", secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      const orgId = s.metadata?.orgId;
      const plan = s.metadata?.plan;
      if (orgId && plan) {
        await prisma.org.update({
          where: { id: orgId },
          data: {
            plan,
            stripeSubscriptionId:
              typeof s.subscription === "string" ? s.subscription : null,
            ...(typeof s.customer === "string"
              ? { stripeCustomerId: s.customer }
              : {}),
          },
        });
      }
    } else if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.orgId;
      if (orgId) {
        const active = sub.status === "active" || sub.status === "trialing";
        const cancelled = event.type === "customer.subscription.deleted" || !active;
        await prisma.org.update({
          where: { id: orgId },
          data: cancelled
            ? { plan: "TRIAL", stripeSubscriptionId: null }
            : { plan: sub.metadata?.plan ?? undefined, stripeSubscriptionId: sub.id },
        });
      }
    }
  } catch (err) {
    console.error("[stripe webhook]", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
