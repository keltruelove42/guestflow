import { describe, expect, it } from "vitest";
import { firstName, renderMessage, seasonFor } from "./render";

describe("merge tags / render", () => {
  it("falls back first_name to there", () => {
    expect(firstName("")).toBe("there");
    expect(firstName("Maya Thompson")).toBe("Maya");
  });

  it("appends unsub footer when missing on EMAIL", () => {
    const out = renderMessage({
      template: "Hi {{first_name}} — stay at {{property}}",
      subject: "Welcome",
      channel: "EMAIL",
      leadName: "Maya Thompson",
      propertyName: "Blue Ridge Lakehouse",
      unsubLink: "https://example.com/unsub",
    });
    expect(out.body).toContain("Maya");
    expect(out.body).toContain("Blue Ridge Lakehouse");
    expect(out.body).toContain("https://example.com/unsub");
    expect(out.html).toContain("Maya");
  });

  it("does not double-append unsub if already present", () => {
    const out = renderMessage({
      template: "Hi {{first_name}}. {{unsub_link}}",
      channel: "EMAIL",
      leadName: "Tom",
      unsubLink: "https://u.test",
    });
    expect(out.body.match(/https:\/\/u\.test/g)?.length).toBe(1);
  });

  it("truncates SMS to 320", () => {
    const out = renderMessage({
      template: "x".repeat(400),
      channel: "SMS",
      leadName: "A",
      unsubLink: "https://u",
    });
    expect(out.body.length).toBeLessThanOrEqual(320);
  });

  it("computes season", () => {
    expect(seasonFor(new Date(Date.UTC(2026, 6, 1)))).toBe("summer"); // July
    expect(seasonFor(new Date(Date.UTC(2026, 11, 15)))).toBe("winter"); // Dec
  });
});
