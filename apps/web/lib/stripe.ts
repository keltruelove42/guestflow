import Stripe from "stripe";

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Billing is not configured (STRIPE_SECRET_KEY missing)");
  return new Stripe(key);
}

/** Flat workspace pricing, cents. Kept in sync with the pricing page. */
export const PLAN_PRICING = {
  STARTER: {
    name: "LeadCoda Starter",
    monthly: 2900,
    annual: 28800, // $24/mo billed annually
  },
  GROWTH: {
    name: "LeadCoda Growth",
    monthly: 7900,
    annual: 76800, // $64/mo billed annually
  },
} as const;

export type PaidPlan = keyof typeof PLAN_PRICING;
export type BillingInterval = "monthly" | "annual";
