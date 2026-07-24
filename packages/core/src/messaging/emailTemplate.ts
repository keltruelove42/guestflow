import { escapeHtml } from "./render";

/**
 * Branded email header/footer partial — the single rendering path for every
 * outgoing email. Reads the org's BrandSettings at send time; no per-email
 * design work. Layout: logo top-left, accent-color bar, business name,
 * optional hero photo under the header, body, muted footer.
 *
 * Email-client-safe by construction: tables + inline styles only, no
 * external CSS, no web fonts (the optional `font` preference falls back
 * through a system stack).
 */

export type BrandContext = {
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  businessName?: string | null;
  font?: string | null;
};

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const DEFAULT_PRIMARY = "#1a1a2e";
const DEFAULT_ACCENT = "#047857";

/** Only ever emit a validated hex color into inline styles. */
export function safeColor(value: string | null | undefined, fallback: string): string {
  const v = (value ?? "").trim();
  return HEX_COLOR.test(v) ? v : fallback;
}

/** Whitelist of font stacks selectable in brand settings. */
const FONT_STACKS: Record<string, string> = {
  system:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'Courier New', Courier, monospace",
};

export function fontStack(font: string | null | undefined): string {
  return FONT_STACKS[(font ?? "").trim().toLowerCase()] ?? FONT_STACKS.system!;
}

function isHttpUrl(value: string | null | undefined): value is string {
  const v = (value ?? "").trim();
  return v.startsWith("https://") || v.startsWith("http://");
}

export type BrandedEmailInput = {
  /** Already-rendered, HTML-escaped body (merge tags applied, \n → <br/>). */
  bodyHtml: string;
  brand?: BrandContext | null;
  /** Optional per-sequence hero photo, rendered under the header. */
  heroPhotoUrl?: string | null;
  /** Fallback display name when brand.businessName is empty. */
  businessNameFallback?: string;
};

/**
 * Wrap a rendered email body in the branded header/footer.
 * Missing pieces degrade gracefully: no logo → text lockup; no colors →
 * defaults; no hero → header renders alone.
 */
export function renderBrandedEmailHtml(input: BrandedEmailInput): string {
  const brand = input.brand ?? {};
  const primary = safeColor(brand.primaryColor, DEFAULT_PRIMARY);
  const accent = safeColor(brand.accentColor, DEFAULT_ACCENT);
  const family = fontStack(brand.font);
  const name = escapeHtml(
    (brand.businessName ?? "").trim() || (input.businessNameFallback ?? "").trim(),
  );

  const logo = isHttpUrl(brand.logoUrl)
    ? `<img src="${escapeHtml(brand.logoUrl.trim())}" alt="${name || "Logo"}" height="36" style="display:block;max-height:36px;width:auto;border:0;" />`
    : name
      ? `<span style="font-size:18px;font-weight:700;color:${primary};">${name}</span>`
      : "";

  const header = `
    <tr>
      <td style="padding:20px 24px 14px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td align="left" style="vertical-align:middle;">${logo}</td>
          ${name && isHttpUrl(brand.logoUrl) ? `<td align="right" style="vertical-align:middle;font-size:13px;font-weight:600;color:${primary};">${name}</td>` : ""}
        </tr></table>
      </td>
    </tr>
    <tr><td style="height:4px;line-height:4px;font-size:0;background-color:${accent};">&nbsp;</td></tr>`;

  const hero = isHttpUrl(input.heroPhotoUrl)
    ? `
    <tr>
      <td style="padding:0;">
        <img src="${escapeHtml(input.heroPhotoUrl.trim())}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
      </td>
    </tr>`
    : "";

  const footer = `
    <tr>
      <td style="padding:18px 24px 22px 24px;border-top:1px solid #e6e6ef;">
        <p style="margin:0;font-size:12px;line-height:1.5;color:#8a8aa0;">${name || "&nbsp;"}</p>
      </td>
    </tr>`;

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#f4f4f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f8;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;font-family:${family};">
        ${header}${hero}
        <tr>
          <td style="padding:22px 24px;font-size:15px;line-height:1.6;color:${primary};">${input.bodyHtml}</td>
        </tr>
        ${footer}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
