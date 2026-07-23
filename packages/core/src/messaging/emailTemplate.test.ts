import { describe, expect, it } from "vitest";
import { fontStack, renderBrandedEmailHtml, safeColor } from "./emailTemplate";
import { renderMessage } from "./render";

describe("safeColor", () => {
  it("accepts valid hex colors", () => {
    expect(safeColor("#fff", "#000000")).toBe("#fff");
    expect(safeColor("#4f46e5", "#000000")).toBe("#4f46e5");
    expect(safeColor("#4f46e5ff", "#000000")).toBe("#4f46e5ff");
  });

  it("rejects anything that is not a hex color (style injection)", () => {
    expect(safeColor("red;background:url(x)", "#000000")).toBe("#000000");
    expect(safeColor("#gggggg", "#000000")).toBe("#000000");
    expect(safeColor("", "#000000")).toBe("#000000");
    expect(safeColor(null, "#000000")).toBe("#000000");
  });
});

describe("fontStack", () => {
  it("falls back to system for unknown values", () => {
    expect(fontStack("comic sans")).toContain("-apple-system");
    expect(fontStack(null)).toContain("-apple-system");
    expect(fontStack("serif")).toContain("Georgia");
  });
});

describe("renderBrandedEmailHtml", () => {
  const brand = {
    logoUrl: "https://blob.example.com/logo.png",
    primaryColor: "#1a1a2e",
    accentColor: "#e94560",
    businessName: "Coda Motors",
  };

  it("renders logo, accent bar, business name and body", () => {
    const html = renderBrandedEmailHtml({ bodyHtml: "Hello<br/>there", brand });
    expect(html).toContain('src="https://blob.example.com/logo.png"');
    expect(html).toContain("background-color:#e94560");
    expect(html).toContain("Coda Motors");
    expect(html).toContain("Hello<br/>there");
  });

  it("renders hero photo under the header only when provided", () => {
    const withHero = renderBrandedEmailHtml({
      bodyHtml: "x",
      brand,
      heroPhotoUrl: "https://blob.example.com/hero.jpg",
    });
    expect(withHero).toContain('src="https://blob.example.com/hero.jpg"');
    const withoutHero = renderBrandedEmailHtml({ bodyHtml: "x", brand });
    expect(withoutHero).not.toContain("hero.jpg");
  });

  it("degrades gracefully with no brand at all", () => {
    const html = renderBrandedEmailHtml({
      bodyHtml: "x",
      brand: null,
      businessNameFallback: "Fallback Biz",
    });
    expect(html).toContain("Fallback Biz");
    expect(html).toContain("background-color:#4f46e5"); // default accent
    expect(html).not.toContain("<img");
  });

  it("ignores non-http logo/hero urls", () => {
    const html = renderBrandedEmailHtml({
      bodyHtml: "x",
      brand: { ...brand, logoUrl: "javascript:alert(1)" },
      heroPhotoUrl: "data:text/html,evil",
    });
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:text");
  });

  it("escapes the business name", () => {
    const html = renderBrandedEmailHtml({
      bodyHtml: "x",
      brand: { businessName: '<script>alert("x")</script>' },
    });
    expect(html).not.toContain("<script>");
  });
});

describe("renderMessage brand wrapping", () => {
  const base = {
    template: "Hi {{first_name}}",
    subject: "Hello",
    channel: "EMAIL" as const,
    leadName: "Jamie Rivera",
    unsubLink: "https://app/u?x=1",
  };

  it("keeps legacy plain html when brand is omitted", () => {
    const r = renderMessage(base);
    expect(r.html).not.toContain("<!DOCTYPE html>");
    expect(r.html).toContain("Hi Jamie");
  });

  it("wraps html in the branded partial when brand is provided", () => {
    const r = renderMessage({
      ...base,
      brand: { businessName: "Coda Motors", accentColor: "#e94560" },
      heroPhotoUrl: "https://blob.example.com/hero.jpg",
    });
    expect(r.html).toContain("<!DOCTYPE html>");
    expect(r.html).toContain("Coda Motors");
    expect(r.html).toContain("hero.jpg");
    expect(r.html).toContain("Hi Jamie");
    // unsubscribe footer still enforced inside the body
    expect(r.html).toContain("https://app/u?x=1");
    // plain-text body untouched by branding
    expect(r.body).not.toContain("<");
  });

  it("wraps even when brand row is null (defaults + org variables fallback)", () => {
    const r = renderMessage({
      ...base,
      brand: null,
      orgVariables: { business_name: "Var Biz" },
    });
    expect(r.html).toContain("<!DOCTYPE html>");
    expect(r.html).toContain("Var Biz");
  });
});
