export type AuthKind = "oauth" | "api_key" | "credentials";

export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "password" | "url";
  placeholder?: string;
  required?: boolean;
  help?: string;
};

export type ProviderMeta = {
  provider: string;
  name: string;
  desc: string;
  icon: string;
  bg: string;
  auth: AuthKind;
  /** Provider also supports a one-click OAuth connect (partner app) */
  oauthOption?: boolean;
  fields: FieldDef[];
  /** Sync is implemented against a live API */
  syncLive: boolean;
  docsUrl?: string;
  setupHint?: string;
};

export const PROVIDER_CATALOG: ProviderMeta[] = [
  {
    provider: "meta",
    name: "Meta Lead Ads",
    desc: "Sync instant-form leads from Instagram & Facebook in real time.",
    icon: "📘",
    bg: "#1877f2",
    auth: "oauth",
    fields: [],
    syncLive: true,
    docsUrl: "https://developers.facebook.com/docs/marketing-api/guides/lead-ads",
    setupHint: "Set META_APP_ID and META_APP_SECRET in your environment.",
  },
  {
    provider: "tiktok",
    name: "TikTok Lead Gen",
    desc: "Pull leads from TikTok Instant Forms via the Business API.",
    icon: "🎵",
    bg: "#111",
    auth: "oauth",
    fields: [],
    syncLive: false,
    setupHint: "Set TIKTOK_APP_ID and TIKTOK_APP_SECRET in your environment.",
  },
  {
    provider: "pinterest",
    name: "Pinterest Ads",
    desc: "Capture lead ad submissions from Pinterest campaigns.",
    icon: "📌",
    bg: "#e60023",
    auth: "oauth",
    fields: [],
    syncLive: false,
    setupHint: "Set PINTEREST_APP_ID and PINTEREST_APP_SECRET in your environment.",
  },
  {
    provider: "hostfully",
    name: "Hostfully",
    desc: "Import inquiries & quotes; detect abandoned inquiries automatically.",
    icon: "🏡",
    bg: "#00a699",
    auth: "api_key",
    oauthOption: true,
    setupHint:
      "One-click connect needs Hostfully partner app credentials: set HOSTFULLY_CLIENT_ID and HOSTFULLY_CLIENT_SECRET (apply at dev.hostfully.com). Agency API keys keep working as a fallback.",
    fields: [
      {
        key: "apiKey",
        label: "Agency API key",
        type: "password",
        required: true,
        placeholder: "hf_…",
        help: "From Hostfully → Settings → API",
      },
      {
        key: "agencyUid",
        label: "Agency UID (optional)",
        type: "text",
        required: false,
        placeholder: "UUID from Hostfully",
      },
    ],
    syncLive: true,
    docsUrl: "https://dev.hostfully.com/",
  },
  {
    provider: "hostaway",
    name: "Hostaway",
    desc: "Sync inquiries, reservations and guest profiles from Hostaway PMS.",
    icon: "🧭",
    bg: "#f5a623",
    auth: "credentials",
    fields: [
      {
        key: "accountId",
        label: "Account ID",
        type: "text",
        required: true,
      },
      {
        key: "clientSecret",
        label: "API client secret",
        type: "password",
        required: true,
      },
    ],
    syncLive: true,
    docsUrl: "https://api.hostaway.com/documentation",
  },
  {
    provider: "stayfi",
    name: "StayFi",
    desc: "Capture in-stay guest email & phone via WiFi splash pages.",
    icon: "📶",
    bg: "#0ea5e9",
    auth: "api_key",
    fields: [
      {
        key: "apiKey",
        label: "API key",
        type: "password",
        required: true,
      },
    ],
    syncLive: false,
  },
  {
    provider: "ownerrez",
    name: "OwnerRez",
    desc: "Sync inquiries, quotes and guests from OwnerRez.",
    icon: "🔑",
    bg: "#5a67d8",
    auth: "api_key",
    fields: [
      {
        key: "apiKey",
        label: "API token",
        type: "password",
        required: true,
      },
      {
        key: "userId",
        label: "User / email",
        type: "text",
        required: true,
        help: "OwnerRez API uses basic auth (email + token).",
      },
    ],
    syncLive: false,
  },
  {
    provider: "lodgify",
    name: "Lodgify",
    desc: "Capture visitors who start but don't finish a booking.",
    icon: "🛎️",
    bg: "#7c3aed",
    auth: "api_key",
    fields: [
      {
        key: "apiKey",
        label: "API key",
        type: "password",
        required: true,
      },
    ],
    syncLive: false,
  },
  {
    provider: "klaviyo",
    name: "Klaviyo",
    desc: "Push segments & mirror follow-up events through Klaviyo.",
    icon: "✉️",
    bg: "#0f172a",
    auth: "api_key",
    fields: [
      {
        key: "apiKey",
        label: "Private API key",
        type: "password",
        required: true,
        placeholder: "pk_…",
      },
    ],
    syncLive: true,
  },
  {
    provider: "twilio",
    name: "Twilio SMS",
    desc: "Send automated text follow-ups from your own number.",
    icon: "💬",
    bg: "#f22f46",
    auth: "credentials",
    fields: [
      {
        key: "accountSid",
        label: "Account SID",
        type: "text",
        required: true,
        placeholder: "AC…",
      },
      {
        key: "authToken",
        label: "Auth token",
        type: "password",
        required: true,
      },
      {
        key: "fromNumber",
        label: "From number (E.164)",
        type: "text",
        required: true,
        placeholder: "+15551234567",
        help: "US traffic needs A2P 10DLC registration.",
      },
    ],
    syncLive: true,
    docsUrl: "https://www.twilio.com/docs/sms/a2p-10dlc",
  },
  {
    provider: "stripe",
    name: "Stripe",
    desc: "Attribute recovered bookings & revenue back to campaigns.",
    icon: "💳",
    bg: "#635bff",
    auth: "oauth",
    fields: [],
    syncLive: false,
    setupHint: "Set STRIPE_CLIENT_ID and STRIPE_SECRET_KEY in your environment.",
  },
];

export function getProviderMeta(provider: string): ProviderMeta | undefined {
  return PROVIDER_CATALOG.find((p) => p.provider === provider.toLowerCase());
}
