import type { PmsBooking, PmsInquiry, PmsProvider } from "./types";

type HostawayCreds = { accountId: string; clientSecret: string };

export class HostawayPmsProvider implements PmsProvider {
  readonly name = "hostaway";
  private token: string | null = null;

  constructor(private readonly creds: HostawayCreds) {}

  private async accessToken(): Promise<string> {
    if (this.token) return this.token;
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.creds.accountId,
      client_secret: this.creds.clientSecret,
      scope: "general",
    });
    const res = await fetch("https://api.hostaway.com/v1/accessTokens", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as { access_token?: string; message?: string };
    if (!res.ok || !data.access_token) {
      throw new Error(data.message ?? "Hostaway auth failed");
    }
    this.token = data.access_token;
    return this.token;
  }

  private async get(path: string) {
    const token = await this.accessToken();
    const res = await fetch(`https://api.hostaway.com/v1${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Hostaway ${res.status}: ${text.slice(0, 160)}`);
    }
    return res.json();
  }

  async syncInquiries(since: Date): Promise<PmsInquiry[]> {
    const data = (await this.get(
      `/reservations?limit=100&arrivalStartDate=${since.toISOString().slice(0, 10)}`,
    )) as { result?: unknown[] };
    const rows = Array.isArray(data.result) ? data.result : [];
    return rows
      .filter((raw) => {
        const r = raw as Record<string, unknown>;
        const status = String(r.status ?? "").toLowerCase();
        return status === "inquiry" || status === "pending" || status === "awaitingPayment";
      })
      .map((raw, i) => {
        const r = raw as Record<string, unknown>;
        return {
          externalRef: String(r.id ?? `ha_inq_${i}`),
          propertyExternalId: r.listingMapId != null ? String(r.listingMapId) : undefined,
          name: String(r.guestName ?? "Guest"),
          email: r.guestEmail ? String(r.guestEmail) : undefined,
          phone: r.phone ? String(r.phone) : undefined,
          dates:
            r.arrivalDate && r.departureDate
              ? `${r.arrivalDate} → ${r.departureDate}`
              : undefined,
          partySize: r.numberOfGuests != null ? String(r.numberOfGuests) : undefined,
          startedAt: r.reservationDate
            ? new Date(String(r.reservationDate))
            : new Date(),
          completedBooking: false,
        };
      });
  }

  async syncBookings(since: Date): Promise<PmsBooking[]> {
    const data = (await this.get(
      `/reservations?limit=100&arrivalStartDate=${since.toISOString().slice(0, 10)}`,
    )) as { result?: unknown[] };
    const rows = Array.isArray(data.result) ? data.result : [];
    return rows
      .filter((raw) => {
        const r = raw as Record<string, unknown>;
        const status = String(r.status ?? "").toLowerCase();
        return status === "new" || status === "modified" || status === "confirmed";
      })
      .map((raw, i) => {
        const r = raw as Record<string, unknown>;
        return {
          externalRef: String(r.id ?? `ha_book_${i}`),
          propertyExternalId: r.listingMapId != null ? String(r.listingMapId) : undefined,
          name: r.guestName ? String(r.guestName) : undefined,
          email: r.guestEmail ? String(r.guestEmail) : undefined,
          phone: r.phone ? String(r.phone) : undefined,
          amountCents:
            r.totalPrice != null ? Math.round(Number(r.totalPrice) * 100) : undefined,
          bookedAt: r.reservationDate
            ? new Date(String(r.reservationDate))
            : new Date(),
          checkoutAt: r.departureDate ? new Date(String(r.departureDate)) : undefined,
        };
      });
  }
}
