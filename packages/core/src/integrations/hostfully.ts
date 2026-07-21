import type { PmsBooking, PmsInquiry, PmsProvider } from "./types";

type HostfullyCreds = {
  apiKey?: string;
  accessToken?: string;
  agencyUid?: string;
};

/**
 * Live Hostfully PMS adapter (docs/08).
 * Uses API key header; falls back across v1/v2 path shapes.
 */
export class HostfullyPmsProvider implements PmsProvider {
  readonly name = "hostfully";

  constructor(private readonly creds: HostfullyCreds) {}

  private headers(): Record<string, string> {
    const base: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (this.creds.accessToken) {
      // OAuth partner connect (works on every Hostfully tier)
      base.Authorization = `Bearer ${this.creds.accessToken}`;
    } else if (this.creds.apiKey) {
      base["X-HOSTFULLY-APIKEY"] = this.creds.apiKey;
    }
    return base;
  }

  private leadPaths(query: string): string[] {
    // OAuth tokens are for API v3; agency API keys use v2 paths.
    return this.creds.accessToken
      ? [
          `https://platform.hostfully.com/api/v3/leads?${query}`,
          `https://api.hostfully.com/v3/leads?${query}`,
        ]
      : [
          `https://api.hostfully.com/v2/leads?${query}`,
          `https://api.hostfully.com/api/leads?${query}`,
        ];
  }

  private bookingPaths(query: string): string[] {
    return this.creds.accessToken
      ? [
          `https://platform.hostfully.com/api/v3/bookings?${query}`,
          `https://api.hostfully.com/v3/bookings?${query}`,
        ]
      : [
          `https://api.hostfully.com/v2/appointments?${query}`,
          `https://api.hostfully.com/api/appointments?${query}`,
        ];
  }

  async syncInquiries(since: Date): Promise<PmsInquiry[]> {
    const sinceIso = since.toISOString();
    // Hostfully leads / inquiries endpoint varies by plan — try common paths
    const paths = this.leadPaths(`updatedSince=${encodeURIComponent(sinceIso)}`);

    for (const url of paths) {
      const res = await fetch(url, { headers: this.headers() });
      if (res.status === 404) continue;
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Hostfully inquiries ${res.status}: ${text.slice(0, 160)}`);
      }
      const data = (await res.json()) as unknown;
      return mapHostfullyLeads(data);
    }
    return [];
  }

  async syncBookings(since: Date): Promise<PmsBooking[]> {
    const sinceIso = since.toISOString();
    const paths = this.bookingPaths(`updatedSince=${encodeURIComponent(sinceIso)}`);

    for (const url of paths) {
      const res = await fetch(url, { headers: this.headers() });
      if (res.status === 404) continue;
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Hostfully bookings ${res.status}: ${text.slice(0, 160)}`);
      }
      const data = (await res.json()) as unknown;
      return mapHostfullyBookings(data);
    }
    return [];
  }
}

function asArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const key of ["leads", "appointments", "properties", "data", "items"]) {
      if (Array.isArray(o[key])) return o[key] as unknown[];
    }
  }
  return [];
}

function mapHostfullyLeads(data: unknown): PmsInquiry[] {
  return asArray(data).map((raw, i) => {
    const r = raw as Record<string, unknown>;
    const guest = (r.guest as Record<string, unknown> | undefined) ?? r;
    const name =
      String(guest.name ?? guest.fullName ?? `${guest.firstName ?? ""} ${guest.lastName ?? ""}`.trim()) ||
      "Guest";
    return {
      externalRef: String(r.uid ?? r.id ?? r.leadUid ?? `hf_lead_${i}`),
      propertyExternalId: r.propertyUid
        ? String(r.propertyUid)
        : r.propertyId
          ? String(r.propertyId)
          : undefined,
      name,
      email: guest.email ? String(guest.email) : undefined,
      phone: guest.phone ? String(guest.phone) : undefined,
      dates: r.arrivalDate
        ? `${r.arrivalDate}${r.departureDate ? ` → ${r.departureDate}` : ""}`
        : undefined,
      partySize: r.guestCount != null ? String(r.guestCount) : undefined,
      startedAt: r.createdDate ? new Date(String(r.createdDate)) : new Date(),
      completedBooking: Boolean(r.booked || r.status === "BOOKED"),
    };
  });
}

function mapHostfullyBookings(data: unknown): PmsBooking[] {
  return asArray(data)
    .filter((raw) => {
      const r = raw as Record<string, unknown>;
      const status = String(r.status ?? r.bookingStatus ?? "").toUpperCase();
      return status.includes("BOOK") || status === "CONFIRMED" || r.booked === true;
    })
    .map((raw, i) => {
      const r = raw as Record<string, unknown>;
      const guest = (r.guest as Record<string, unknown> | undefined) ?? r;
      return {
        externalRef: String(r.uid ?? r.id ?? `hf_book_${i}`),
        propertyExternalId: r.propertyUid ? String(r.propertyUid) : undefined,
        name: guest.name ? String(guest.name) : undefined,
        email: guest.email ? String(guest.email) : undefined,
        phone: guest.phone ? String(guest.phone) : undefined,
        amountCents:
          r.totalPrice != null
            ? Math.round(Number(r.totalPrice) * 100)
            : undefined,
        bookedAt: r.createdDate ? new Date(String(r.createdDate)) : new Date(),
        checkoutAt: r.departureDate ? new Date(String(r.departureDate)) : undefined,
        inquiryExternalRef: r.leadUid ? String(r.leadUid) : undefined,
      };
    });
}
