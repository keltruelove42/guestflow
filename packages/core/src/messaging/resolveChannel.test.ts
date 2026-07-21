import { describe, expect, it } from "vitest";
import { resolveChannel, rewriteForFallback } from "./resolveChannel";

const base = {
  email: null as string | null,
  phone: null as string | null,
  emailConsent: false,
  smsConsent: false,
  unsubscribedAt: null as Date | null,
  smsStoppedAt: null as Date | null,
};

describe("resolveChannel", () => {
  it("sends email when wanted and consented", () => {
    const r = resolveChannel("EMAIL", {
      ...base,
      email: "a@b.com",
      emailConsent: true,
    });
    expect(r).toEqual({ action: "SEND", channel: "EMAIL" });
  });

  it("falls back EMAIL→SMS", () => {
    const r = resolveChannel("EMAIL", {
      ...base,
      phone: "+15551212",
      smsConsent: true,
    });
    expect(r).toEqual({ action: "SEND", channel: "SMS", fallbackFrom: "EMAIL" });
  });

  it("falls back SMS→EMAIL", () => {
    const r = resolveChannel("SMS", {
      ...base,
      email: "a@b.com",
      emailConsent: true,
    });
    expect(r).toEqual({ action: "SEND", channel: "EMAIL", fallbackFrom: "SMS" });
  });

  it("skips when no channel", () => {
    expect(resolveChannel("EMAIL", base).action).toBe("SKIP");
    expect(resolveChannel("SMS", base).action).toBe("SKIP");
  });

  it("blocks unsubscribed email", () => {
    const r = resolveChannel("EMAIL", {
      ...base,
      email: "a@b.com",
      emailConsent: true,
      unsubscribedAt: new Date(),
      phone: "+1",
      smsConsent: true,
    });
    expect(r).toEqual({ action: "SEND", channel: "SMS", fallbackFrom: "EMAIL" });
  });

  it("blocks STOP'd SMS", () => {
    const r = resolveChannel("SMS", {
      ...base,
      phone: "+1",
      smsConsent: true,
      smsStoppedAt: new Date(),
      email: "a@b.com",
      emailConsent: true,
    });
    expect(r).toEqual({ action: "SEND", channel: "EMAIL", fallbackFrom: "SMS" });
  });

  it("requires consent even with contact present", () => {
    expect(
      resolveChannel("EMAIL", { ...base, email: "a@b.com", emailConsent: false })
        .action,
    ).toBe("SKIP");
  });

  it("rewrites EMAIL→SMS truncation", () => {
    const long = "x".repeat(400);
    const out = rewriteForFallback({
      from: "EMAIL",
      to: "SMS",
      subject: "Hi",
      body: long,
      propertyName: "Lake",
    });
    expect(out.body.length).toBeLessThanOrEqual(303);
    expect(out.subject).toBeNull();
  });

  it("rewrites SMS→EMAIL with generic subject", () => {
    const out = rewriteForFallback({
      from: "SMS",
      to: "EMAIL",
      subject: null,
      body: "Hello",
      propertyName: "Blue Ridge",
    });
    expect(out.subject).toBe("A note about Blue Ridge");
    expect(out.body).toBe("Hello");
  });
});
