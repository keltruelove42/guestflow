/**
 * Vertical packs — everything that makes LeadCoda speak an industry's
 * language. The engine (leads, sequences, messaging, campaigns) is
 * identical for every vertical; packs supply vocabulary, labels, and copy.
 */

export type VerticalId = "RENTALS" | "TRADES" | "BEAUTY";

export type VerticalPack = {
  id: VerticalId;
  /** Shown on the industry picker */
  label: string;
  pickerDesc: string;
  icon: string;
  /** The thing a lead is interested in (today's Property model) */
  context: {
    singular: string;
    plural: string;
    icon: string;
    /** Show the tab in navigation? */
    showInNav: boolean;
    /** Placeholder examples for empty states */
    examples: string[];
  };
  /** Lead table / drawer field labels */
  fields: {
    timeframe: string; // Lead.travelDates
    detail: string; // Lead.partySize
  };
  /** Pipeline stage display labels (keys = Stage enum) */
  stageLabels: Record<string, string>;
  /** Dashboard KPI card titles */
  kpis: {
    newLeads: string;
    costPerLead: string;
    replyRate: string;
    recovered: string;
    revenueCaption: string;
  };
  /** Generic-report word for a converted lead */
  wonLabel: string;
  /** Onboarding + first-run copy */
  copy: {
    welcomeTagline: string;
    welcomeBullets: [string, string, string];
    loginBlurb: string;
    leadsPageHint: string;
    followupsDesc: string;
  };
  /** Providers to feature first on the Integrations page */
  featuredIntegrations: string[];
};

export const VERTICAL_PACKS: Record<VerticalId, VerticalPack> = {
  RENTALS: {
    id: "RENTALS",
    label: "Vacation & long-term rentals",
    pickerDesc: "STR hosts, property managers, and landlords",
    icon: "🏡",
    context: {
      singular: "Property",
      plural: "Properties",
      icon: "🏘️",
      showInNav: true,
      examples: ["Blue Ridge Lakehouse", "Palm Cove Condo"],
    },
    fields: {
      timeframe: "Dates",
      detail: "Party size",
    },
    stageLabels: {
      NEW: "New",
      CONTACTED: "Contacted",
      ENGAGED: "Engaged",
      QUOTED: "Quoted",
      BOOKED: "Booked",
      LOST: "Lost",
    },
    kpis: {
      newLeads: "New leads · 30 days",
      costPerLead: "Blended cost per lead",
      replyRate: "Follow-up reply rate",
      recovered: "Recovered bookings",
      revenueCaption: "attributed revenue",
    },
    wonLabel: "Booked",
    copy: {
      welcomeTagline:
        "Capture leads from ads and your booking site, follow up automatically, and reply from one inbox.",
      welcomeBullets: [
        "Launch lead ads",
        "Automate follow-ups",
        "Send email & SMS",
      ],
      loginBlurb: "Capture leads, run follow-ups, and convert bookings.",
      leadsPageHint:
        "Every contact field is optional at capture — LeadCoda picks the best follow-up channel from whatever it has. Open a lead to send email or SMS.",
      followupsDesc:
        "Follow-ups start automatically the moment a lead is captured or an inquiry is abandoned. Replies pause the sequence and flag the lead for you; bookings stop it.",
    },
    featuredIntegrations: ["hostfully", "hostaway", "meta", "stayfi"],
  },

  TRADES: {
    id: "TRADES",
    label: "Home services & trades",
    pickerDesc: "Plumbers, electricians, renovators, handymen",
    icon: "🔧",
    context: {
      singular: "Service",
      plural: "Services",
      icon: "🛠️",
      showInNav: true,
      examples: ["Water heater replacement", "Panel upgrade", "Kitchen reno"],
    },
    fields: {
      timeframe: "Job timeframe",
      detail: "Job details",
    },
    stageLabels: {
      NEW: "New",
      CONTACTED: "Contacted",
      ENGAGED: "Engaged",
      QUOTED: "Estimate sent",
      BOOKED: "Won",
      LOST: "Lost",
    },
    kpis: {
      newLeads: "New leads · 30 days",
      costPerLead: "Blended cost per lead",
      replyRate: "Follow-up reply rate",
      recovered: "Recovered jobs",
      revenueCaption: "attributed revenue",
    },
    wonLabel: "Won",
    copy: {
      welcomeTagline:
        "Never lose a job to slow follow-up. Capture inquiries, text and email back automatically, and win the estimate.",
      welcomeBullets: [
        "Capture every inquiry",
        "Automate estimate follow-ups",
        "Text & email from one inbox",
      ],
      loginBlurb: "Capture inquiries, follow up automatically, and win more jobs.",
      leadsPageHint:
        "Every contact field is optional at capture — LeadCoda picks the best follow-up channel from whatever it has. Open a lead to text or email them.",
      followupsDesc:
        "Follow-ups start automatically the moment an inquiry comes in or an estimate goes quiet. Replies pause the sequence and flag the lead for you; a won job stops it.",
    },
    featuredIntegrations: ["meta", "twilio", "klaviyo", "stripe"],
  },

  BEAUTY: {
    id: "BEAUTY",
    label: "Salon & beauty",
    pickerDesc: "Hair, nails, lashes, massage & wellness",
    icon: "💅",
    context: {
      singular: "Service",
      plural: "Services",
      icon: "✨",
      showInNav: true,
      examples: ["Balayage & color", "Gel manicure", "90-min deep tissue"],
    },
    fields: {
      timeframe: "Preferred time",
      detail: "Service details",
    },
    stageLabels: {
      NEW: "New",
      CONTACTED: "Contacted",
      ENGAGED: "Engaged",
      QUOTED: "Consult offered",
      BOOKED: "Booked",
      LOST: "Lost",
    },
    kpis: {
      newLeads: "New leads · 30 days",
      costPerLead: "Blended cost per lead",
      replyRate: "Follow-up reply rate",
      recovered: "Recovered bookings",
      revenueCaption: "attributed revenue",
    },
    wonLabel: "Booked",
    copy: {
      welcomeTagline:
        "Fill your book and keep it full. Capture new-client inquiries, follow up automatically, and bring regulars back on schedule.",
      welcomeBullets: [
        "Capture new-client inquiries",
        "Automate rebooking nudges",
        "Text & email from one inbox",
      ],
      loginBlurb: "Capture inquiries, follow up automatically, and keep your book full.",
      leadsPageHint:
        "Every contact field is optional at capture — LeadCoda picks the best follow-up channel from whatever it has. Open a lead to text or email them.",
      followupsDesc:
        "Follow-ups start automatically when an inquiry comes in or a booking is left unfinished. Replies pause the sequence and flag the lead for you; a booked appointment stops it.",
    },
    featuredIntegrations: ["meta", "tiktok", "klaviyo", "twilio"],
  },
};

export const VERTICAL_LIST: VerticalPack[] = Object.values(VERTICAL_PACKS);

export const DEFAULT_VERTICAL: VerticalId = "RENTALS";

export function getVerticalPack(id: string | null | undefined): VerticalPack {
  return VERTICAL_PACKS[(id as VerticalId) ?? DEFAULT_VERTICAL] ?? VERTICAL_PACKS.RENTALS;
}
