import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

/** Legacy route: integrations now live under Settings. Preserves query params
 * (OAuth callbacks return to /integrations?connected=…|error=…). */
export default function LegacyIntegrationsRedirect({
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
  redirect(`/settings/integrations${suffix ? `?${suffix}` : ""}`);
}
