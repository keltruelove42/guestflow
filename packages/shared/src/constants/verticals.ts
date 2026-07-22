/**
 * Vertical packs, everything that makes LeadCoda speak an industry's
 * language. The engine (leads, sequences, messaging, campaigns) is
 * identical for every vertical; packs supply vocabulary, labels, and copy.
 */

export type VerticalId =
  | "RENTALS"
  | "TRADES"
  | "BEAUTY"
  | "DEALERSHIPS"
  | "SAAS"
  | "ECOMMERCE"
  | "REALESTATE"
  | "HOTELS";

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
  /** Sequence trigger captions in this industry's language (keys = SequenceTrigger enum) */
  triggerLabels: Record<string, string>;
  /** Suggested ad-audience interests for the campaign builder */
  adInterests: string[];
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
    triggerLabels: {
      AD_LEAD_CAPTURED: "New lead captured from a connected ad platform",
      INQUIRY_ABANDONED: "Booking inquiry started but not finished",
      QUOTE_UNACCEPTED_48H: "Quote sent but not accepted within 48 hours",
      CHECKOUT_PLUS_90D: "90 days after checkout",
      MANUAL_ONLY: "Manual enrollment only",
    },
    adInterests: [
      "Lake vacations",
      "Cabin rentals",
      "Beach trips",
      "Family travel",
      "Hiking",
      "Weddings",
      "Remote work",
      "Pet-friendly travel",
    ],
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
        "Every contact field is optional at capture. LeadCoda picks the best follow-up channel from whatever it has. Open a lead to send email or SMS.",
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
    triggerLabels: {
      AD_LEAD_CAPTURED: "New job inquiry captured from an ad",
      INQUIRY_ABANDONED: "Estimate request started but not finished",
      QUOTE_UNACCEPTED_48H: "Estimate sent but no answer within 48 hours",
      CHECKOUT_PLUS_90D: "90 days after the job wrapped",
      MANUAL_ONLY: "Manual enrollment only",
    },
    adInterests: [
      "Home improvement",
      "Home ownership",
      "DIY",
      "Kitchen remodel",
      "Bathroom remodel",
      "HVAC",
      "Landscaping",
      "Real estate",
    ],
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
        "Every contact field is optional at capture. LeadCoda picks the best follow-up channel from whatever it has. Open a lead to text or email them.",
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
    triggerLabels: {
      AD_LEAD_CAPTURED: "New client inquiry captured from an ad",
      INQUIRY_ABANDONED: "Online booking started but not finished",
      QUOTE_UNACCEPTED_48H: "Consult offered but no booking within 48 hours",
      CHECKOUT_PLUS_90D: "90 days since their last visit",
      MANUAL_ONLY: "Manual enrollment only",
    },
    adInterests: [
      "Hair care",
      "Nails",
      "Skincare",
      "Massage",
      "Wellness",
      "Bridal",
      "Fashion",
      "Self care",
    ],
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
        "Every contact field is optional at capture. LeadCoda picks the best follow-up channel from whatever it has. Open a lead to text or email them.",
      followupsDesc:
        "Follow-ups start automatically when an inquiry comes in or a booking is left unfinished. Replies pause the sequence and flag the lead for you; a booked appointment stops it.",
    },
    featuredIntegrations: ["meta", "tiktok", "klaviyo", "twilio"],
  },

  DEALERSHIPS: {
    id: "DEALERSHIPS",
    label: "Auto & marine dealers",
    pickerDesc: "Car, truck, boat & powersports dealerships",
    icon: "🚗",
    context: {
      singular: "Vehicle",
      plural: "Inventory",
      icon: "🚙",
      showInNav: true,
      examples: ["2023 Ford F-150 XLT", "Certified pre-owned SUVs", "Sea Ray SPX 210"],
    },
    fields: {
      timeframe: "Purchase timeframe",
      detail: "Trade-in & financing",
    },
    stageLabels: {
      NEW: "New",
      CONTACTED: "Contacted",
      ENGAGED: "Engaged",
      QUOTED: "Offer sent",
      BOOKED: "Sold",
      LOST: "Lost",
    },
    triggerLabels: {
      AD_LEAD_CAPTURED: "New vehicle inquiry captured from an ad",
      INQUIRY_ABANDONED: "Credit application started but not finished",
      QUOTE_UNACCEPTED_48H: "Offer sent but no response within 48 hours",
      CHECKOUT_PLUS_90D: "90 days after purchase",
      MANUAL_ONLY: "Manual enrollment only",
    },
    adInterests: [
      "Trucks",
      "SUVs",
      "Car shopping",
      "Boating",
      "Fishing",
      "Off-roading",
      "Motorcycles",
      "Family vehicles",
    ],
    kpis: {
      newLeads: "New leads · 30 days",
      costPerLead: "Blended cost per lead",
      replyRate: "Follow-up reply rate",
      recovered: "Recovered deals",
      revenueCaption: "attributed revenue",
    },
    wonLabel: "Sold",
    copy: {
      welcomeTagline:
        "Speed wins deals. Capture inquiries from every listing site, reply in seconds automatically, and get shoppers on the lot.",
      welcomeBullets: [
        "Capture every inquiry",
        "Automate test-drive follow-ups",
        "Text & email from one inbox",
      ],
      loginBlurb: "Capture inquiries, follow up in seconds, and move more units.",
      leadsPageHint:
        "Every contact field is optional at capture. LeadCoda picks the best follow-up channel from whatever it has. Open a lead to text or email them.",
      followupsDesc:
        "Follow-ups start automatically the moment an inquiry comes in or an offer goes quiet. Replies pause the sequence and flag the lead for you; a sold deal stops it.",
    },
    featuredIntegrations: ["meta", "twilio", "klaviyo", "stripe"],
  },

  SAAS: {
    id: "SAAS",
    label: "B2B SaaS & software",
    pickerDesc: "SaaS startups, agencies & software vendors",
    icon: "💻",
    context: {
      singular: "Product",
      plural: "Products",
      icon: "🧩",
      showInNav: true,
      examples: ["Starter Plan", "Pro Plan", "Enterprise"],
    },
    fields: {
      timeframe: "Evaluation timeline",
      detail: "Company & team size",
    },
    stageLabels: {
      NEW: "New",
      CONTACTED: "Contacted",
      ENGAGED: "Engaged",
      QUOTED: "Proposal sent",
      BOOKED: "Closed won",
      LOST: "Closed lost",
    },
    triggerLabels: {
      AD_LEAD_CAPTURED: "New signup or demo request captured",
      INQUIRY_ABANDONED: "Trial started but went quiet",
      QUOTE_UNACCEPTED_48H: "Proposal sent but no response within 48 hours",
      CHECKOUT_PLUS_90D: "90 days after purchase (expansion check-in)",
      MANUAL_ONLY: "Manual enrollment only",
    },
    adInterests: [
      "SaaS",
      "Startups",
      "Small business",
      "Marketing tools",
      "Productivity",
      "Entrepreneurship",
      "Remote work",
      "B2B services",
    ],
    kpis: {
      newLeads: "New leads · 30 days",
      costPerLead: "Blended cost per lead",
      replyRate: "Follow-up reply rate",
      recovered: "Recovered deals",
      revenueCaption: "attributed revenue",
    },
    wonLabel: "Closed won",
    copy: {
      welcomeTagline:
        "Turn trials into paying teams. Capture signups and demo requests, follow up automatically, and step in when a deal warms up.",
      welcomeBullets: [
        "Capture every signup & demo request",
        "Automate trial and proposal follow-ups",
        "Email & text from one inbox",
      ],
      loginBlurb: "Capture signups, follow up automatically, and close more deals.",
      leadsPageHint:
        "Every contact field is optional at capture. LeadCoda picks the best follow-up channel from whatever it has. Open a lead to email or text them.",
      followupsDesc:
        "Follow-ups start automatically when a signup comes in or a trial goes quiet. Replies pause the sequence and flag the lead for you; a closed deal stops it.",
    },
    featuredIntegrations: ["meta", "klaviyo", "stripe", "twilio"],
  },

  ECOMMERCE: {
    id: "ECOMMERCE",
    label: "D2C & ecommerce",
    pickerDesc: "Online stores and direct-to-consumer brands",
    icon: "🛍️",
    context: {
      singular: "Product",
      plural: "Products",
      icon: "📦",
      showInNav: true,
      examples: ["Best-Seller Bundle", "Subscription Box", "New Arrivals Drop"],
    },
    fields: {
      timeframe: "Last order / intent",
      detail: "Cart & preferences",
    },
    stageLabels: {
      NEW: "New",
      CONTACTED: "Contacted",
      ENGAGED: "Engaged",
      QUOTED: "Offer sent",
      BOOKED: "Purchased",
      LOST: "Lost",
    },
    triggerLabels: {
      AD_LEAD_CAPTURED: "New lead captured from an ad",
      INQUIRY_ABANDONED: "Cart abandoned at checkout",
      QUOTE_UNACCEPTED_48H: "Offer sent but not redeemed within 48 hours",
      CHECKOUT_PLUS_90D: "90 days after purchase (replenishment)",
      MANUAL_ONLY: "Manual enrollment only",
    },
    adInterests: [
      "Online shopping",
      "Beauty products",
      "Fashion",
      "Home goods",
      "Fitness gear",
      "Subscription boxes",
      "Wellness",
      "Sustainable brands",
    ],
    kpis: {
      newLeads: "New leads · 30 days",
      costPerLead: "Blended cost per lead",
      replyRate: "Follow-up reply rate",
      recovered: "Recovered carts",
      revenueCaption: "attributed revenue",
    },
    wonLabel: "Purchased",
    copy: {
      welcomeTagline:
        "Rescue abandoned carts and bring buyers back. Capture leads from ads, follow up automatically, and turn browsers into repeat customers.",
      welcomeBullets: [
        "Rescue abandoned carts",
        "Automate welcome & winback flows",
        "Email & text from one inbox",
      ],
      loginBlurb: "Capture leads, rescue carts, and grow repeat purchases.",
      leadsPageHint:
        "Every contact field is optional at capture. LeadCoda picks the best follow-up channel from whatever it has. Open a lead to email or text them.",
      followupsDesc:
        "Follow-ups start automatically when a lead comes in or a cart is abandoned. Replies pause the sequence and flag the lead for you; a purchase stops it.",
    },
    featuredIntegrations: ["meta", "tiktok", "klaviyo", "stripe"],
  },

  REALESTATE: {
    id: "REALESTATE",
    label: "Real estate",
    pickerDesc: "Agents, teams & brokerages",
    icon: "🏠",
    context: {
      singular: "Listing",
      plural: "Listings",
      icon: "🏘️",
      showInNav: true,
      examples: ["412 Maple Grove Ln", "The Wilder Lofts #204"],
    },
    fields: {
      timeframe: "Buying / selling timeline",
      detail: "Budget & preferences",
    },
    stageLabels: {
      NEW: "New",
      CONTACTED: "Contacted",
      ENGAGED: "Engaged",
      QUOTED: "Showing scheduled",
      BOOKED: "Under contract",
      LOST: "Lost",
    },
    triggerLabels: {
      AD_LEAD_CAPTURED: "New listing inquiry captured from an ad",
      INQUIRY_ABANDONED: "Listing inquiry started but not finished",
      QUOTE_UNACCEPTED_48H: "Showing offered but not booked within 48 hours",
      CHECKOUT_PLUS_90D: "90 days after closing (referral check-in)",
      MANUAL_ONLY: "Manual enrollment only",
    },
    adInterests: [
      "Home buying",
      "Real estate",
      "First-time buyers",
      "Mortgage",
      "Moving",
      "Investment property",
      "Open houses",
      "Relocation",
    ],
    kpis: {
      newLeads: "New leads · 30 days",
      costPerLead: "Blended cost per lead",
      replyRate: "Follow-up reply rate",
      recovered: "Recovered clients",
      revenueCaption: "attributed commission",
    },
    wonLabel: "Under contract",
    copy: {
      welcomeTagline:
        "Answer every listing inquiry before the other agent does. Capture leads, follow up automatically, and win the showing.",
      welcomeBullets: [
        "Capture every listing inquiry",
        "Automate showing follow-ups",
        "Text & email from one inbox",
      ],
      loginBlurb: "Capture inquiries, follow up first, and win more clients.",
      leadsPageHint:
        "Every contact field is optional at capture. LeadCoda picks the best follow-up channel from whatever it has. Open a lead to text or email them.",
      followupsDesc:
        "Follow-ups start automatically the moment an inquiry comes in or a showing goes quiet. Replies pause the sequence and flag the lead for you; going under contract stops it.",
    },
    featuredIntegrations: ["meta", "twilio", "klaviyo", "stripe"],
  },

  HOTELS: {
    id: "HOTELS",
    label: "Hotels & B&Bs",
    pickerDesc: "Boutique hotels, inns & bed and breakfasts",
    icon: "🏨",
    context: {
      singular: "Room",
      plural: "Rooms",
      icon: "🛏️",
      showInNav: true,
      examples: ["King Suite with Fireplace", "Garden Queen Room"],
    },
    fields: {
      timeframe: "Stay dates",
      detail: "Guests & room preference",
    },
    stageLabels: {
      NEW: "New",
      CONTACTED: "Contacted",
      ENGAGED: "Engaged",
      QUOTED: "Quoted",
      BOOKED: "Booked",
      LOST: "Lost",
    },
    triggerLabels: {
      AD_LEAD_CAPTURED: "New booking inquiry captured from an ad",
      INQUIRY_ABANDONED: "Direct booking started but not finished",
      QUOTE_UNACCEPTED_48H: "Quote sent but not accepted within 48 hours",
      CHECKOUT_PLUS_90D: "90 days after checkout (return stay)",
      MANUAL_ONLY: "Manual enrollment only",
    },
    adInterests: [
      "Weekend getaways",
      "Boutique hotels",
      "Travel",
      "Anniversaries",
      "Spa retreats",
      "Wine country",
      "Local events",
      "Romantic trips",
    ],
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
        "Turn lookers into direct bookings. Capture inquiries, rescue abandoned reservations, and bring past guests back.",
      welcomeBullets: [
        "Rescue abandoned bookings",
        "Automate quote follow-ups",
        "Bring past guests back",
      ],
      loginBlurb: "Capture inquiries, follow up automatically, and fill more rooms.",
      leadsPageHint:
        "Every contact field is optional at capture. LeadCoda picks the best follow-up channel from whatever it has. Open a lead to email or text them.",
      followupsDesc:
        "Follow-ups start automatically when an inquiry comes in or a booking is left unfinished. Replies pause the sequence and flag the lead for you; a confirmed booking stops it.",
    },
    featuredIntegrations: ["meta", "klaviyo", "twilio", "stripe"],
  },
};

export type AppointmentType = {
  key: string;
  label: string;
  minutes: number;
  icon: string;
};

/** Bookable appointment types, in each industry's language. */
export function getAppointmentTypes(id: VerticalId | string | null | undefined): AppointmentType[] {
  switch (id) {
    case "TRADES":
      return [
        { key: "estimate", label: "Estimate visit", minutes: 60, icon: "📐" },
        { key: "job", label: "Job slot", minutes: 120, icon: "🔧" },
        { key: "call", label: "Phone consult", minutes: 15, icon: "📞" },
      ];
    case "BEAUTY":
      return [
        { key: "appointment", label: "Appointment", minutes: 60, icon: "💅" },
        { key: "consult", label: "Consultation", minutes: 15, icon: "💬" },
      ];
    case "DEALERSHIPS":
      return [
        { key: "testdrive", label: "Test drive", minutes: 30, icon: "🚗" },
        { key: "appraisal", label: "Trade-in appraisal", minutes: 30, icon: "📋" },
        { key: "delivery", label: "Vehicle delivery", minutes: 60, icon: "🔑" },
      ];
    case "SAAS":
      return [
        { key: "demo", label: "Product demo", minutes: 30, icon: "🖥️" },
        { key: "onboarding", label: "Onboarding call", minutes: 45, icon: "🚀" },
        { key: "call", label: "Intro call", minutes: 15, icon: "📞" },
      ];
    case "ECOMMERCE":
      return [
        { key: "consult", label: "Virtual consult", minutes: 20, icon: "🛍️" },
        { key: "call", label: "Support call", minutes: 15, icon: "📞" },
      ];
    case "REALESTATE":
      return [
        { key: "showing", label: "Showing", minutes: 30, icon: "🏠" },
        { key: "consult", label: "Listing consult", minutes: 45, icon: "📋" },
        { key: "call", label: "Buyer intro call", minutes: 15, icon: "📞" },
      ];
    case "HOTELS":
      return [
        { key: "tour", label: "Property tour", minutes: 30, icon: "🏨" },
        { key: "call", label: "Planning call", minutes: 15, icon: "📞" },
      ];
    default: // RENTALS
      return [
        { key: "tour", label: "Property tour", minutes: 30, icon: "🏡" },
        { key: "call", label: "Planning call", minutes: 15, icon: "📞" },
      ];
  }
}

export const VERTICAL_LIST: VerticalPack[] = Object.values(VERTICAL_PACKS);

export const DEFAULT_VERTICAL: VerticalId = "RENTALS";

export function getVerticalPack(id: string | null | undefined): VerticalPack {
  return VERTICAL_PACKS[(id as VerticalId) ?? DEFAULT_VERTICAL] ?? VERTICAL_PACKS.RENTALS;
}
