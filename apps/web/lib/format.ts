export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function relativeTime(iso: string, now = new Date()): string {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now.getTime() - t);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export const SOURCE_LABEL: Record<string, string> = {
  META: "Meta IG/FB",
  TIKTOK: "TikTok",
  DIRECT_SITE: "Direct site",
  PINTEREST: "Pinterest",
  WIFI: "WiFi guest",
  MANUAL: "Manual",
  IMPORT: "Import",
};

/** Soft pastel fill keeping source hue (easier on eyes than solid blocks). */
export function softSourceFill(cssVar: string, strength = 42): string {
  return `color-mix(in srgb, ${cssVar} ${strength}%, var(--surface))`;
}

export function sourceCssVar(source: string): string {
  const map: Record<string, string> = {
    META: "var(--s1)",
    TIKTOK: "var(--s2)",
    DIRECT_SITE: "var(--s3)",
    PINTEREST: "var(--s4)",
    WIFI: "var(--s5)",
    MANUAL: "var(--s7)",
    IMPORT: "var(--s7)",
  };
  return map[source] ?? "var(--s7)";
}

export function stageCssVar(stage: string): string {
  const map: Record<string, string> = {
    NEW: "var(--s1)",
    CONTACTED: "var(--s2)",
    ENGAGED: "var(--s5)",
    QUOTED: "var(--s4)",
    BOOKED: "var(--good)",
    LOST: "var(--muted)",
  };
  return map[stage] ?? "var(--muted)";
}

export function activityIcon(type: string): string {
  if (type.includes("EMAIL") || type === "MANUAL_MESSAGE") return "✉️";
  if (type.includes("SMS")) return "💬";
  if (type === "REPLIED") return "↩️";
  if (type === "BOOKED") return "✅";
  if (type.includes("INQUIRY") || type === "CAPTURED") return "📥";
  if (type.includes("SEQUENCE") || type === "ENROLLED") return "🔁";
  if (type === "CALL_DUE") return "📞";
  if (type === "STAGE_CHANGED") return "🏷️";
  return "•";
}
