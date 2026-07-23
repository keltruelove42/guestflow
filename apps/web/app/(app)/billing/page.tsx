import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

/** Legacy route: billing now lives under Settings. Preserves query params
 * (Stripe returns to /billing?status=success|cancelled). */
export default function LegacyBillingRedirect({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value)) for (const v of value) qs.append(key, v);
  }
  const suffix = qs.toString();
  redirect(`/settings/billing${suffix ? `?${suffix}` : ""}`);
}
