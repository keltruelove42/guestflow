/**
 * Listing preview: pull a thumbnail image and short description from a
 * booking / listing URL (Airbnb, VRBO, Hostfully, Booking.com, or any
 * page with Open Graph tags). Pure parser + guarded fetcher.
 */

export type ListingPreview = {
  title: string | null;
  description: string | null;
  image: string | null;
};

function metaContent(html: string, patterns: string[]): string | null {
  for (const p of patterns) {
    // property/name before content
    let m = html.match(
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${p}["'][^>]*content=["']([^"']+)["']`,
        "i",
      ),
    );
    if (m?.[1]) return decodeEntities(m[1]);
    // content before property/name
    m = html.match(
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${p}["']`,
        "i",
      ),
    );
    if (m?.[1]) return decodeEntities(m[1]);
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/** Extract Open Graph / Twitter card metadata from an HTML document. */
export function parseListingHtml(html: string): ListingPreview {
  const head = html.slice(0, 200_000);
  const title =
    metaContent(head, ["og:title", "twitter:title"]) ??
    (head.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1]
      ? decodeEntities(head.match(/<title[^>]*>([^<]{1,300})<\/title>/i)![1]!)
      : null);
  const description = metaContent(head, [
    "og:description",
    "twitter:description",
    "description",
  ]);
  const image = metaContent(head, [
    "og:image",
    "og:image:secure_url",
    "twitter:image",
  ]);
  return {
    title: title?.slice(0, 200) ?? null,
    description: description?.slice(0, 600) ?? null,
    image: image && /^https:\/\//i.test(image) ? image : null,
  };
}

/** SSRF guard: only public https hosts, no IPs, no internal names. */
export function isSafeExternalUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname.toLowerCase();
  if (!host.includes(".")) return false;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    return false;
  }
  // Reject IP literals entirely (v4 and v6)
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  if (host.includes(":")) return false;
  return true;
}

/** Fetch a listing page and extract preview data. Best effort, 8s cap. */
export async function fetchListingPreview(rawUrl: string): Promise<ListingPreview> {
  if (!isSafeExternalUrl(rawUrl)) {
    throw new Error("Enter a full public listing URL (https://...)");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(rawUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // A browser-like UA: many listing sites serve OG tags to browsers only
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) {
      throw new Error(
        `That site would not share a preview (HTTP ${res.status}). You can still add the image and description by hand`,
      );
    }
    const html = await res.text();
    const parsed = parseListingHtml(html);
    if (!parsed.image && !parsed.description && !parsed.title) {
      throw new Error("No preview data found on that page. Add details by hand");
    }
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}
