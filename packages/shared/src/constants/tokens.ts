/** Design tokens from docs/06-web-app.md / prototype */
export const tokens = {
  light: {
    page: "#f9f9f7",
    surface: "#fcfcfb",
    surface2: "#f0efec",
    ink: "#0b0b0b",
    ink2: "#52514e",
    muted: "#898781",
    grid: "#e1e0d9",
    border: "rgba(11,11,11,.10)",
    accent: "#2a78d6",
  },
  dark: {
    page: "#0d0d0d",
    surface: "#1a1a19",
    surface2: "#242422",
    ink: "#ffffff",
    ink2: "#c3c2b7",
    muted: "#898781",
    grid: "#2c2c2a",
    border: "rgba(255,255,255,.10)",
    accent: "#3987e5",
  },
  series: {
    light: {
      s1: "#2a78d6",
      s2: "#eb6834",
      s3: "#1baf7a",
      s4: "#eda100",
      s5: "#e87ba4",
      s6: "#008300",
      s7: "#4a3aa7",
      s8: "#e34948",
    },
    dark: {
      s1: "#3987e5",
      s2: "#d95926",
      s3: "#199e70",
      s4: "#c98500",
      s5: "#d55181",
      s6: "#008300",
      s7: "#9085e9",
      s8: "#e66767",
    },
  },
  status: {
    good: "#0ca30c",
    warn: "#fab219",
    serious: "#ec835a",
    critical: "#d03b3b",
    goodText: "#006300",
  },
  radius: {
    card: "14px",
    control: "8px",
    pill: "99px",
  },
} as const;

/** Fixed source → series color keys (never reassigned by rank) */
export const SOURCE_COLOR: Record<string, keyof typeof tokens.series.light> = {
  META: "s1",
  TIKTOK: "s2",
  DIRECT_SITE: "s3",
  PINTEREST: "s4",
  WIFI: "s5",
  MANUAL: "s7",
  IMPORT: "s7",
};

export const STAGE_COLOR: Record<string, string> = {
  NEW: "s1",
  CONTACTED: "s2",
  ENGAGED: "s5",
  QUOTED: "s4",
  BOOKED: "good",
  LOST: "muted",
};
