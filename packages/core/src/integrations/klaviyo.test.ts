import { describe, expect, it } from "vitest";
import { mapKlaviyoProfiles } from "./klaviyo";

describe("mapKlaviyoProfiles", () => {
  it("maps name, contact and per-profile consent", () => {
    const rows = mapKlaviyoProfiles([
      {
        id: "1",
        attributes: {
          email: "jane@example.com",
          phone_number: "+13055550100",
          first_name: "Jane",
          last_name: "Smith",
          subscriptions: {
            email: { marketing: { consent: "SUBSCRIBED" } },
            sms: { marketing: { consent: "NEVER_SUBSCRIBED" } },
          },
        },
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Jane Smith",
      email: "jane@example.com",
      phone: "+13055550100",
      emailConsent: true,
      smsConsent: false,
    });
  });

  it("falls back to email local part for name and skips contactless profiles", () => {
    const rows = mapKlaviyoProfiles([
      { id: "1", attributes: { email: "solo@example.com" } },
      { id: "2", attributes: { first_name: "Ghost" } },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("solo");
    expect(rows[0]?.emailConsent).toBe(false);
  });
});
