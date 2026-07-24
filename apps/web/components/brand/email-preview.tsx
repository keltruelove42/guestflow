"use client";

/**
 * Live preview of the branded email header/footer — mirrors the server-side
 * partial in packages/core/src/messaging/emailTemplate.ts (logo top-left,
 * accent bar, business name, optional hero photo, body, muted footer).
 * Pure presentation: feed it form state for instant preview.
 */

export type EmailPreviewBrand = {
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  businessName?: string | null;
  font?: string | null;
};

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const FONTS: Record<string, string> = {
  system:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'Courier New', Courier, monospace",
};

function color(v: string | null | undefined, fallback: string) {
  return v && HEX.test(v.trim()) ? v.trim() : fallback;
}

export function EmailHeaderPreview({
  brand,
  heroPhotoUrl,
  subject,
  body,
}: {
  brand: EmailPreviewBrand;
  heroPhotoUrl?: string | null;
  subject?: string | null;
  body?: string | null;
}) {
  const primary = color(brand.primaryColor, "#1a1a2e");
  const accent = color(brand.accentColor, "#047857");
  const family = FONTS[brand.font ?? "system"] ?? FONTS.system!;
  const name = (brand.businessName ?? "").trim();

  return (
    <div className="overflow-hidden rounded-card border border-[var(--border)] bg-[#f4f4f8] p-4">
      {subject != null && (
        <p className="mb-2 truncate text-xs text-[#8a8aa0]">
          Subject: <span className="font-medium text-[#4a4a5e]">{subject || "—"}</span>
        </p>
      )}
      <div
        className="mx-auto max-w-md overflow-hidden rounded-lg bg-white shadow-sm"
        style={{ fontFamily: family }}
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logoUrl}
              alt={name || "Logo"}
              className="block h-8 w-auto"
            />
          ) : (
            <span className="text-base font-bold" style={{ color: primary }}>
              {name || "Your business"}
            </span>
          )}
          {brand.logoUrl && name && (
            <span className="text-xs font-semibold" style={{ color: primary }}>
              {name}
            </span>
          )}
        </div>
        <div className="h-1" style={{ backgroundColor: accent }} />
        {heroPhotoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroPhotoUrl} alt="" className="block max-h-40 w-full object-cover" />
        )}
        <div
          className="whitespace-pre-line px-5 py-4 text-sm leading-relaxed"
          style={{ color: primary }}
        >
          {body?.trim() ||
            "Hi {{first_name}} — thanks for reaching out! Here's what happens next…"}
        </div>
        <div className="border-t border-[#e6e6ef] px-5 py-3">
          <p className="text-[11px] text-[#8a8aa0]">{name || " "}</p>
        </div>
      </div>
    </div>
  );
}
