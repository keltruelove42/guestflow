import type { Metadata } from "next";
import { PricingPage } from "@/components/marketing/pricing";

export const metadata: Metadata = {
  title: "Pricing · LeadCoda",
  description:
    "Flat workspace pricing for the follow-up CRM. Starter, Growth, and Enterprise plans plus white-glove setup, consulting, and BDR-for-hire add-ons.",
};

export default function Pricing() {
  return <PricingPage />;
}
