import { describe, expect, it } from "vitest";
import { isSafeExternalUrl, parseListingHtml } from "./listingPreview";

const SAMPLE = `<!doctype html><html><head>
<title>Fallback Title</title>
<meta property="og:title" content="Little Luxe Lodge &amp; Spa" />
<meta property="og:description" content="A cozy 1-bedroom wellness lodge in Blue Ridge with a hot tub &amp; mountain views." />
<meta property="og:image" content="https://cdn.example.com/lodge.jpg" />
</head><body></body></html>`;

describe("parseListingHtml", () => {
  it("extracts og tags and decodes entities", () => {
    const p = parseListingHtml(SAMPLE);
    expect(p.title).toBe("Little Luxe Lodge & Spa");
    expect(p.description).toContain("wellness lodge in Blue Ridge");
    expect(p.image).toBe("https://cdn.example.com/lodge.jpg");
  });

  it("handles content-first attribute order and falls back to <title>", () => {
    const html = `<head><title>Only Title Here</title>
      <meta content="https://cdn.example.com/x.jpg" property="og:image"/></head>`;
    const p = parseListingHtml(html);
    expect(p.title).toBe("Only Title Here");
    expect(p.image).toBe("https://cdn.example.com/x.jpg");
  });

  it("rejects non-https images", () => {
    const html = `<head><meta property="og:image" content="http://cdn.example.com/x.jpg"/></head>`;
    expect(parseListingHtml(html).image).toBeNull();
  });
});

describe("isSafeExternalUrl", () => {
  it("allows public https listings", () => {
    expect(isSafeExternalUrl("https://www.airbnb.com/rooms/12345")).toBe(true);
    expect(isSafeExternalUrl("https://book.hostfully.com/x/property-details/1")).toBe(true);
  });
  it("blocks SSRF targets", () => {
    expect(isSafeExternalUrl("http://localhost:3000/admin")).toBe(false);
    expect(isSafeExternalUrl("https://192.168.1.1/router")).toBe(false);
    expect(isSafeExternalUrl("https://metadata.internal/creds")).toBe(false);
    expect(isSafeExternalUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeExternalUrl("not a url")).toBe(false);
  });
});
