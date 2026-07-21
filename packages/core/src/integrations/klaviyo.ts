import type { ImportRow } from "../leads/importLeads";

const KLAVIYO_REVISION = "2024-10-15";

type KlaviyoProfileRecord = {
  id?: string;
  attributes?: {
    email?: string | null;
    phone_number?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    subscriptions?: {
      email?: { marketing?: { consent?: string | null } | null } | null;
      sms?: { marketing?: { consent?: string | null } | null } | null;
    } | null;
  };
};

export type KlaviyoImportRow = ImportRow & {
  emailConsent?: boolean;
  smsConsent?: boolean;
};

/** Map Klaviyo profile records to import rows (exported for tests). */
export function mapKlaviyoProfiles(records: KlaviyoProfileRecord[]): KlaviyoImportRow[] {
  const rows: KlaviyoImportRow[] = [];
  for (const rec of records) {
    const a = rec.attributes ?? {};
    const email = a.email?.trim() || null;
    const phone = a.phone_number?.trim() || null;
    if (!email && !phone) continue;

    const name =
      [a.first_name?.trim(), a.last_name?.trim()].filter(Boolean).join(" ") ||
      (email ? email.split("@")[0] : null) ||
      "Klaviyo contact";

    rows.push({
      name,
      email,
      phone,
      notes: null,
      // Consent comes from Klaviyo's own subscription state, per profile.
      emailConsent: a.subscriptions?.email?.marketing?.consent === "SUBSCRIBED",
      smsConsent: a.subscriptions?.sms?.marketing?.consent === "SUBSCRIBED",
    });
  }
  return rows;
}

/**
 * Fetch profiles from Klaviyo (newest first, paginated). Capped at
 * `maxPages` x 100 profiles per sync — repeat syncs are safe because the
 * importer dedupes by email/phone.
 */
export async function fetchKlaviyoProfiles(
  apiKey: string,
  opts?: { maxPages?: number },
): Promise<{ rows: KlaviyoImportRow[]; fetched: number; capped: boolean }> {
  const maxPages = opts?.maxPages ?? 10;
  const records: KlaviyoProfileRecord[] = [];
  let url: string | null =
    "https://a.klaviyo.com/api/profiles/?page[size]=100&sort=-created" +
    "&additional-fields[profile]=subscriptions";
  let pages = 0;

  while (url && pages < maxPages) {
    const res: Response = await fetch(url, {
      headers: {
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        Accept: "application/json",
        revision: KLAVIYO_REVISION,
      },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        errors?: Array<{ detail?: string }>;
      } | null;
      throw new Error(
        `Klaviyo profiles fetch failed (HTTP ${res.status})${
          body?.errors?.[0]?.detail ? `: ${body.errors[0].detail}` : ""
        }`,
      );
    }
    const data = (await res.json()) as {
      data?: KlaviyoProfileRecord[];
      links?: { next?: string | null };
    };
    records.push(...(data.data ?? []));
    url = data.links?.next ?? null;
    pages++;
  }

  return {
    rows: mapKlaviyoProfiles(records),
    fetched: records.length,
    capped: Boolean(url),
  };
}
