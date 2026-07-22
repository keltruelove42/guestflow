/**
 * Seed script — reproduces prototype demo data from docs/prototype/guestflow.html
 */
import {
  AdPlatform,
  CampaignStatus,
  Channel,
  IntegrationStatus,
  LeadEventType,
  LeadSource,
  OrgMode,
  PropertyType,
  SequenceTrigger,
  Stage,
  prisma,
} from "./client";

function daysAgo(days: number, hours = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(d.getHours() - hours);
  return d;
}

const DEMO_USER_ID = "demo-user-guestflow";
const DEMO_EMAIL = "taylor@guestflow.demo";

export async function seedDemoOrg(opts?: {
  orgName?: string;
  userId?: string;
  email?: string;
  userName?: string;
  vertical?: "RENTALS" | "TRADES";
}) {
  const userId = opts?.userId ?? DEMO_USER_ID;
  const email = opts?.email ?? DEMO_EMAIL;
  const userName = opts?.userName ?? "Taylor";

  // Wipe existing user/org if re-seeding this email
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const orgId = existing.orgId;
    await prisma.scheduledMessage.deleteMany({ where: { orgId } });
    await prisma.enrollment.deleteMany({ where: { orgId } });
    await prisma.booking.deleteMany({ where: { orgId } });
    await prisma.note.deleteMany({ where: { orgId } });
    await prisma.leadEvent.deleteMany({ where: { orgId } });
    await prisma.lead.deleteMany({ where: { orgId } });
    await prisma.availabilityBlock.deleteMany({ where: { orgId } });
    await prisma.sequenceStep.deleteMany({
      where: { sequence: { orgId } },
    });
    await prisma.sequence.deleteMany({ where: { orgId } });
    await prisma.campaign.deleteMany({ where: { orgId } });
    await prisma.property.deleteMany({ where: { orgId } });
    await prisma.integration.deleteMany({ where: { orgId } });
    await prisma.user.deleteMany({ where: { orgId } });
    await prisma.org.delete({ where: { id: orgId } });
  }

  const vertical = opts?.vertical ?? "RENTALS";
  const org = await prisma.org.create({
    data: {
      name: opts?.orgName ?? "Taylor's Stays",
      mode: OrgMode.DEMO,
      vertical,
      timezone: "America/New_York",
    },
  });

  await prisma.user.create({
    data: {
      id: userId,
      orgId: org.id,
      email,
      name: userName,
      role: "OWNER",
    },
  });

  await seedDemoContent(org.id, vertical);

  return { org, userId, email };
}

/**
 * (Re)create the demo dataset — properties, sequences, campaigns, leads —
 * inside an EXISTING org. Used by first-login seeding and by
 * "Restore demo data" after a clear. All rows are tagged isDemo.
 */
export async function seedDemoContent(
  orgId: string,
  vertical: "RENTALS" | "TRADES" = "RENTALS",
) {
  if (vertical === "TRADES") {
    const { seedTradesContent } = await import("./seedTrades");
    return seedTradesContent(orgId);
  }
  const org = { id: orgId };

  // Template sequences are permanent (they survive "Clear demo data"),
  // so re-seeding must reuse them instead of creating duplicates.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function ensureSequence(args: { data: any; include?: any }): Promise<any> {
    const existing = await prisma.sequence.findFirst({
      where: { orgId: org.id, name: args.data.name, isDemo: true },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    if (existing) return existing;
    return prisma.sequence.create({
      data: args.data,
      include: { steps: { orderBy: { order: "asc" } } },
    });
  }
  const [p1, p2, p3] = await Promise.all([
    prisma.property.create({
      data: {
        orgId: org.id,
        name: "Blue Ridge Lakehouse",
        location: "Lake Lure, NC",
        bedrooms: 4,
        type: PropertyType.SHORT_TERM,
        isDemo: true,
        photoUrl: "🏞️",
        knowledgeBase:
          "Private dock on Lake Lure. Dogs welcome ($50/pet). Max 10 guests. Check-in 4pm, checkout 10am. Hot tub, kayaks, fire pit.",
      },
    }),
    prisma.property.create({
      data: {
        orgId: org.id,
        name: "Palm Cove Condo",
        location: "Destin, FL",
        bedrooms: 2,
        type: PropertyType.SHORT_TERM,
        isDemo: true,
        photoUrl: "🏖️",
        knowledgeBase:
          "Beachfront Destin condo. No pets. Max 6 guests. Pool + beach chairs included. Quiet hours 10pm.",
      },
    }),
    prisma.property.create({
      data: {
        orgId: org.id,
        name: "Maplewood Duplex",
        location: "Nashville, TN",
        bedrooms: 3,
        type: PropertyType.LONG_TERM,
        isDemo: true,
        photoUrl: "🏠",
        knowledgeBase:
          "12-month lease preferred. Utilities not included. Pets case-by-case. Near East Nashville.",
      },
    }),
  ]);

  // Demo availability — blocked/booked ranges for the calendar
  function d(iso: string) {
    return new Date(iso + "T12:00:00.000Z");
  }
  const y = new Date().getFullYear();
  const m = String(new Date().getMonth() + 1).padStart(2, "0");
  await prisma.availabilityBlock.createMany({
    data: [
      {
        orgId: org.id,
        propertyId: p1.id,
        startDate: d(`${y}-${m}-18`),
        endDate: d(`${y}-${m}-21`),
        kind: "BOOKED",
        isDemo: true,
        note: "Aisha Bell — Sep stay (demo)",
      },
      {
        orgId: org.id,
        propertyId: p1.id,
        startDate: d(`${y}-${m}-05`),
        endDate: d(`${y}-${m}-08`),
        kind: "BLOCKED",
        isDemo: true,
        note: "Owner stay",
      },
      {
        orgId: org.id,
        propertyId: p1.id,
        startDate: daysAgo(-14),
        endDate: daysAgo(-11),
        kind: "HOLD",
        isDemo: true,
        note: "Maya Thompson — hold pending quote",
      },
      {
        orgId: org.id,
        propertyId: p2.id,
        startDate: d(`${y}-${m}-14`),
        endDate: d(`${y}-${m}-21`),
        kind: "HOLD",
        isDemo: true,
        note: "Derek Alvarez — quote pending",
      },
      {
        orgId: org.id,
        propertyId: p2.id,
        startDate: daysAgo(-3),
        endDate: daysAgo(2),
        kind: "BOOKED",
        isDemo: true,
        note: "Confirmed guest",
      },
      {
        orgId: org.id,
        propertyId: p3.id,
        startDate: d(`${y}-09-01`),
        endDate: d(`${y}-09-30`),
        kind: "HOLD",
        isDemo: true,
        note: "Jordan & Casey - lease interest",
      },
    ],
  });

  const s1 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Abandoned Inquiry Rescue",
      trigger: SequenceTrigger.INQUIRY_ABANDONED,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 60,
            channel: Channel.EMAIL,
            subject: "Still interested in {{property}}?",
            body: "Hi {{first_name}},\n\nYou started looking at {{property}} for {{dates}}, then the booking timed out. No stress.\n\nYour dates may still be open. Here is a direct link to finish or request a fresh quote: {{quote_link}}\n\nIf something blocked you (dates, price, pets, parking), reply to this email and I will help.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 1,
            delayMinutes: 1440,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, it's {{host_name}} from {{property}}. Your {{dates}} inquiry is still open if you want me to hold it. Reply with questions anytime. (Reply STOP to opt out)",
          },
          {
            order: 2,
            delayMinutes: 2880,
            channel: Channel.CALL,
            subject: "Call: abandoned inquiry",
            body: "Call script: Confirm you are speaking with {{first_name}}. Mention they started a booking for {{property}} on {{dates}}. Ask what stopped them (price, dates, group size, house rules). Offer to hold dates 24h or send an updated quote. Log outcome in notes.",
          },
          {
            order: 3,
            delayMinutes: 4320,
            channel: Channel.EMAIL,
            subject: "I can hold {{dates}} for 24 hours",
            body: "Hi {{first_name}},\n\nQuick follow-up on {{property}}. I can hold {{dates}} for 24 hours if you want first right of refusal.\n\nReply YES and I will lock it, or tell me alternate dates and I will check availability.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 4,
            delayMinutes: 10080,
            channel: Channel.EMAIL,
            subject: "Closing the loop on {{property}}",
            body: "Hi {{first_name}},\n\nI will assume the timing was not right for {{property}}. No hard feelings.\n\nIf plans change, this link stays good for a fresh look: {{quote_link}}\n\nWishing you a great trip wherever you land.\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
    include: { steps: true },
  });

  const s2 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "New Ad Lead Welcome",
      trigger: SequenceTrigger.AD_LEAD_CAPTURED,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.EMAIL,
            subject: "Thanks for your interest in {{property}}",
            body: "Hi {{first_name}},\n\nThanks for reaching out about {{property}}. I am {{host_name}}, and I help guests book direct so you skip platform fees.\n\nNext step: tell me your preferred dates (or a flexible window) and party size, and I will send a clear quote.\n\nLive availability: {{quote_link}}\n\nTalk soon,\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 1,
            delayMinutes: 2880,
            channel: Channel.EMAIL,
            subject: "What guests love about {{property}}",
            body: "Hi {{first_name}},\n\nA few things that usually help when choosing {{property}}:\n\n1) Exact check-in details and house rules up front\n2) Direct booking typically saves 12-15% vs listing sites\n3) I answer personally (not a call center)\n\nIf you share {{dates}} or a range, I can confirm availability today.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 2,
            delayMinutes: 5760,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, it's {{host_name}} from {{property}}. Any dates in mind? I can text a quick quote. (Reply STOP to opt out)",
          },
          {
            order: 3,
            delayMinutes: 10080,
            channel: Channel.CALL,
            subject: "Call: warm ad lead",
            body: "Call script: Introduce yourself as {{host_name}} from {{property}}. Reference they came in from an ad. Ask for target dates and party size. Offer to email a written quote after the call. If no answer, leave a short voicemail and send the SMS follow-up already in this sequence.",
          },
          {
            order: 4,
            delayMinutes: 14400,
            channel: Channel.EMAIL,
            subject: "Still looking for a place?",
            body: "Hi {{first_name}},\n\nChecking in one last time on {{property}}. If the trip is still happening, reply with dates and I will prioritize your quote.\n\nIf you booked elsewhere, no worries. Feel free to keep this link for next time: {{quote_link}}\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
    include: { steps: true },
  });

  const s3 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Quote Sent, No Booking",
      trigger: SequenceTrigger.QUOTE_UNACCEPTED_48H,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 2880,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, it's {{host_name}}. Just checking you got the quote for {{property}} ({{dates}}). Happy to adjust dates or answer questions. (Reply STOP to opt out)",
          },
          {
            order: 1,
            delayMinutes: 4320,
            channel: Channel.EMAIL,
            subject: "Questions on your {{property}} quote?",
            body: "Hi {{first_name}},\n\nYour quote for {{property}} ({{dates}}) is still available. Common things people ask before booking:\n\n- Can we change arrival time?\n- Are pets allowed?\n- What is included vs extra?\n\nReply with any question, or tell me what would make the quote work better.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 2,
            delayMinutes: 2880,
            channel: Channel.CALL,
            subject: "Call: quote follow-up",
            body: "Call script: Confirm they received the quote for {{property}} on {{dates}}. Ask if price, dates, or house rules are the blocker. Offer one concrete concession you can keep (early check-in, late checkout, or a small direct-book courtesy) without discounting blindly. Confirm next step before hanging up.",
          },
          {
            order: 3,
            delayMinutes: 5760,
            channel: Channel.EMAIL,
            subject: "I can tweak the quote for {{property}}",
            body: "Hi {{first_name}},\n\nIf the quote for {{dates}} was close but not quite right, tell me what would help. I can often adjust check-in/out or include a small amenity when you book direct.\n\nQuote link: {{quote_link}}\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
    include: { steps: true },
  });

  await ensureSequence({
    data: {
      orgId: org.id,
      name: "Conversation Went Cold",
      trigger: SequenceTrigger.MANUAL_ONLY,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 2880,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, it's {{host_name}} from {{property}}. Circling back in case my last note got buried. Still happy to help with {{dates}}. (Reply STOP to opt out)",
          },
          {
            order: 1,
            delayMinutes: 2880,
            channel: Channel.EMAIL,
            subject: "Did my last note get buried?",
            body: "Hi {{first_name}},\n\nWe were chatting about {{property}} and things went quiet. Totally fine if timing shifted.\n\nIf you are still considering {{dates}}, reply with a yes/no and I will pick up right where we left off.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 2,
            delayMinutes: 2880,
            channel: Channel.CALL,
            subject: "Call: re-engage silent lead",
            body: "Call script: Keep it short. Reference the last open question. Ask if they still want help with {{property}}. If voicemail, leave name, property, and that a text is fine. Do not pitch discounts on this call.",
          },
          {
            order: 3,
            delayMinutes: 7200,
            channel: Channel.EMAIL,
            subject: "Should I close your file?",
            body: "Hi {{first_name}},\n\nI will close your {{property}} file for now so I am not filling your inbox.\n\nIf you want it reopened later, reply OPEN and I will jump back in.\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
  });

  await ensureSequence({
    data: {
      orgId: org.id,
      name: "Price Shopping / Comparing Options",
      trigger: SequenceTrigger.MANUAL_ONLY,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.EMAIL,
            subject: "Why guests book {{property}} direct",
            body: "Hi {{first_name}},\n\nTotally fair to compare options. When guests choose {{property}} direct, they usually care about:\n\n- Clear all-in pricing (fewer surprise fees)\n- Faster answers from the host\n- Flexible check-in when we can accommodate it\n\nIf you share the quote you are comparing, I will tell you honestly whether we are a fit.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 1,
            delayMinutes: 1440,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}} here. If price is the main concern for {{property}}, tell me your target range and I will see what I can do for {{dates}}. (Reply STOP to opt out)",
          },
          {
            order: 2,
            delayMinutes: 2880,
            channel: Channel.CALL,
            subject: "Call: price objection",
            body: "Call script: Ask what total they are comparing against (nightly vs all-in). Explain what is included at {{property}}. Offer value (flexibility, local tips, direct support) before any discount. If discounting, cap it and tie it to booking within 48h. Confirm decision date.",
          },
          {
            order: 3,
            delayMinutes: 4320,
            channel: Channel.EMAIL,
            subject: "A clear next step on {{property}}",
            body: "Hi {{first_name}},\n\nHappy to hold a direct rate for {{dates}} for 48 hours if that helps you decide.\n\nBook or request the hold here: {{quote_link}}\n\nIf another place wins on fit, I genuinely hope the trip is great.\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
  });

  await ensureSequence({
    data: {
      orgId: org.id,
      name: "Requested Dates Unavailable",
      trigger: SequenceTrigger.MANUAL_ONLY,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.EMAIL,
            subject: "Alternate dates for {{property}}",
            body: "Hi {{first_name}},\n\n{{dates}} is not open at {{property}}, but nearby nights often work and sometimes price better midweek.\n\nReply with:\n1) Flexible window (plus/minus a few days)\n2) Must-have nights vs nice-to-have\n\nI will send 2-3 real options with totals.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 1,
            delayMinutes: 1440,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}} at {{property}}. Your first dates were taken. Want me to text 2 alternate windows that are open? (Reply STOP to opt out)",
          },
          {
            order: 2,
            delayMinutes: 2880,
            channel: Channel.CALL,
            subject: "Call: offer alternate dates",
            body: "Call script: Acknowledge the original dates are gone. Present two concrete alternatives with rough totals. Ask which constraints matter most (weekends, check-in day, budget). Send a written follow-up email after the call.",
          },
          {
            order: 3,
            delayMinutes: 5760,
            channel: Channel.EMAIL,
            subject: "Still want help finding dates?",
            body: "Hi {{first_name}},\n\nI can keep watching {{property}} for openings around your window, or help you lock an alternate set this week.\n\nReply WATCH or send new dates and I will take it from there.\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
  });

  await ensureSequence({
    data: {
      orgId: org.id,
      name: "Past Guest Re-engagement",
      trigger: SequenceTrigger.CHECKOUT_PLUS_90D,
      active: false,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.EMAIL,
            subject: "Good to see you again from {{property}}",
            body: "Hi {{first_name}},\n\nIt has been a few months since your stay at {{property}}. Returning guests get first look at open {{season}} dates and a thank-you rate when you book direct.\n\nIf you have a window in mind, reply with dates and I will check them today.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 1,
            delayMinutes: 10080,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, it's {{host_name}}. {{season}} dates at {{property}} are opening up. Want me to hold a weekend for you? (Reply STOP to opt out)",
          },
          {
            order: 2,
            delayMinutes: 10080,
            channel: Channel.CALL,
            subject: "Call: past guest check-in",
            body: "Call script: Thank them for the prior stay. Ask if another trip is planned. Offer returning-guest courtesy and help picking dates. Keep under 3 minutes unless they engage.",
          },
          {
            order: 3,
            delayMinutes: 20160,
            channel: Channel.EMAIL,
            subject: "{{season}} dates at {{property}}",
            body: "Hi {{first_name}},\n\nThe {{season}} calendar for {{property}} is filling. If you want first right on a favorite weekend, reply with 2 date options and I will hold the best one for 24 hours.\n\n{{quote_link}}\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
  });

  const [c1, c2, c3, c4] = await Promise.all([
    prisma.campaign.create({
      data: {
        orgId: org.id,
        propertyId: p1.id,
        platform: AdPlatform.META,
        name: "Fall Lake Getaway — Instant Form",
        status: CampaignStatus.ACTIVE,
        isDemo: true,
        dailyBudgetCents: 2500,
        audience: {
          summary:
            "Atlanta + Charlotte metro · 28–55 · interests: lake vacations, cabin rentals, hiking",
        },
        leadForm: [
          { key: "name", label: "Full name", required: true },
          { key: "email", label: "Email", required: false },
          { key: "phone", label: "Phone (optional)", required: false },
          { key: "dates", label: "Preferred travel dates (optional)", required: false },
        ],
        autoEnrollSequenceId: s2.id,
        spendCents: 41200,
        impressions: 48200,
        clicks: 1130,
        leadsCount: 31,
        startedAt: daysAgo(21),
      },
    }),
    prisma.campaign.create({
      data: {
        orgId: org.id,
        propertyId: p2.id,
        platform: AdPlatform.META,
        name: "Destin Beach Week — Retargeting",
        status: CampaignStatus.ACTIVE,
        isDemo: true,
        dailyBudgetCents: 1800,
        audience: {
          summary: "Website visitors 30d + abandoned inquiries lookalike 1%",
        },
        leadForm: [
          { key: "name", label: "Full name", required: true },
          { key: "email", label: "Email", required: false },
          { key: "phone", label: "Phone (optional)", required: false },
          { key: "party", label: "Party size (optional)", required: false },
        ],
        autoEnrollSequenceId: s2.id,
        spendCents: 27400,
        impressions: 30100,
        clicks: 840,
        leadsCount: 22,
        startedAt: daysAgo(14),
      },
    }),
    prisma.campaign.create({
      data: {
        orgId: org.id,
        propertyId: p1.id,
        platform: AdPlatform.TIKTOK,
        name: "Cabin Tour Video — Lead Gen",
        status: CampaignStatus.PAUSED,
        isDemo: true,
        dailyBudgetCents: 2000,
        audience: { summary: "US Southeast · 22–45 · travel & outdoors interest" },
        leadForm: [
          { key: "name", label: "Name", required: true },
          { key: "email", label: "Email", required: false },
          { key: "phone", label: "Phone (optional)", required: false },
        ],
        autoEnrollSequenceId: s2.id,
        spendCents: 16100,
        impressions: 88400,
        clicks: 2100,
        leadsCount: 9,
        startedAt: daysAgo(28),
      },
    }),
    prisma.campaign.create({
      data: {
        orgId: org.id,
        propertyId: p1.id,
        platform: AdPlatform.PINTEREST,
        name: "Mountain Wedding Stays",
        status: CampaignStatus.ACTIVE,
        isDemo: true,
        dailyBudgetCents: 1000,
        audience: { summary: "Wedding planning + honeymoon boards · US" },
        leadForm: [
          { key: "name", label: "Name", required: true },
          { key: "email", label: "Email", required: false },
          { key: "dates", label: "Event date (optional)", required: false },
        ],
        autoEnrollSequenceId: s2.id,
        spendCents: 9600,
        impressions: 15400,
        clicks: 390,
        leadsCount: 6,
        startedAt: daysAgo(10),
      },
    }),
  ]);

  await prisma.campaign.create({
    data: {
      orgId: org.id,
      propertyId: p3.id,
      platform: AdPlatform.META,
      name: "Nashville Long-Term — Apply Now",
      status: CampaignStatus.DRAFT,
        isDemo: true,
      dailyBudgetCents: 1200,
      audience: {
        summary: "Nashville metro · 24–45 · recently moved / apartment hunting",
      },
      leadForm: [
        { key: "name", label: "Full name", required: true },
        { key: "email", label: "Email", required: true },
        { key: "phone", label: "Phone", required: true },
        { key: "address", label: "Current address (optional)", required: false },
        { key: "dates", label: "Desired move-in date", required: false },
      ],
      spendCents: 0,
      impressions: 0,
      clicks: 0,
      leadsCount: 0,
    },
  });

  for (const provider of [
    "meta",
    "tiktok",
    "hostfully",
    "hostaway",
  ] as const) {
    await prisma.integration.upsert({
      where: { orgId_provider: { orgId: org.id, provider } },
      update: {
        status: IntegrationStatus.CONNECTED,
        isDemo: true,
        lastSyncAt: daysAgo(0, 1),
      },
      create: {
        orgId: org.id,
        provider,
        status: IntegrationStatus.CONNECTED,
        isDemo: true,
        lastSyncAt: daysAgo(0, 1),
      },
    });
  }
  for (const provider of [
    "pinterest",
    "stayfi",
    "ownerrez",
    "lodgify",
    "klaviyo",
    "twilio",
    "stripe",
  ] as const) {
    await prisma.integration.upsert({
      where: { orgId_provider: { orgId: org.id, provider } },
      update: {},
      create: {
        orgId: org.id,
        provider,
        status: IntegrationStatus.DISCONNECTED,
        isDemo: true,
      },
    });
  }

  // --- Leads with timelines (verbatim copy from prototype) ---
  async function createLeadWithTimeline(input: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    source: (typeof LeadSource)[keyof typeof LeadSource];
    campaignId?: string;
    propertyId: string;
    stage: (typeof Stage)[keyof typeof Stage];
    createdAt: Date;
    partySize?: string;
    travelDates?: string;
    emailConsent: boolean;
    smsConsent: boolean;
    needsAttention?: boolean;
    events: Array<{
      type: (typeof LeadEventType)[keyof typeof LeadEventType];
      channel?: (typeof Channel)[keyof typeof Channel];
      title: string;
      body?: string;
      occurredAt: Date;
    }>;
    notes?: Array<{ text: string; createdAt: Date }>;
    enroll?: { sequenceId: string; currentStep: number; status?: "ACTIVE" | "PAUSED" | "STOPPED" | "COMPLETED"; pausedReason?: string };
    booking?: { amountCents: number; bookedAt: Date; campaignId?: string; sequenceId?: string };
  }) {
    const lead = await prisma.lead.create({
      data: {
        orgId: org.id,
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        source: input.source,
        campaignId: input.campaignId,
        propertyId: input.propertyId,
        stage: input.stage,
        partySize: input.partySize,
        travelDates: input.travelDates,
        emailConsent: input.emailConsent,
        smsConsent: input.smsConsent,
        emailConsentAt: input.emailConsent ? input.createdAt : null,
        smsConsentAt: input.smsConsent ? input.createdAt : null,
        needsAttention: input.needsAttention ?? false,
        isDemo: true,
        createdAt: input.createdAt,
        events: {
          create: input.events.map((e) => ({
            orgId: org.id,
            type: e.type,
            channel: e.channel,
            title: e.title,
            body: e.body,
            occurredAt: e.occurredAt,
          })),
        },
        notes: input.notes
          ? {
              create: input.notes.map((n) => ({
                orgId: org.id,
                text: n.text,
                createdAt: n.createdAt,
              })),
            }
          : undefined,
      },
    });

    if (input.enroll) {
      const seq = await prisma.sequence.findUniqueOrThrow({
        where: { id: input.enroll.sequenceId },
        include: { steps: { orderBy: { order: "asc" } } },
      });
      const enrollment = await prisma.enrollment.create({
        data: {
          orgId: org.id,
          leadId: lead.id,
          sequenceId: input.enroll.sequenceId,
          status: input.enroll.status ?? "ACTIVE",
          currentStep: input.enroll.currentStep,
          pausedReason: input.enroll.pausedReason,
          createdAt: input.createdAt,
        },
      });
      // Pending scheduled messages for remaining steps
      for (let i = input.enroll.currentStep; i < seq.steps.length; i++) {
        const step = seq.steps[i]!;
        const sendAt = new Date();
        sendAt.setDate(sendAt.getDate() + (i - input.enroll.currentStep) * 2 + 1);
        await prisma.scheduledMessage.create({
          data: {
            orgId: org.id,
            enrollmentId: enrollment.id,
            stepId: step.id,
            channel: step.channel,
            sendAt,
            status: "PENDING",
            idempotencyKey: `${enrollment.id}:${step.id}`,
          },
        });
      }
    }

    if (input.booking) {
      await prisma.booking.create({
        data: {
          orgId: org.id,
          leadId: lead.id,
          propertyId: input.propertyId,
          amountCents: input.booking.amountCents,
          bookedAt: input.booking.bookedAt,
          attributedCampaignId: input.booking.campaignId,
          attributedSequenceId: input.booking.sequenceId,
        },
      });
    }

    return lead;
  }

  await createLeadWithTimeline({
    name: "Maya Thompson",
    email: "maya.t@gmail.com",
    phone: "(404) 555-0132",
    address: "Atlanta, GA",
    source: LeadSource.META,
    campaignId: c1.id,
    propertyId: p1.id,
    stage: Stage.ENGAGED,
    createdAt: daysAgo(6),
    partySize: "4 adults, 2 kids",
    travelDates: "Oct 9–12",
    emailConsent: true,
    smsConsent: true,
    needsAttention: true,
    events: [
      {
        type: LeadEventType.CAPTURED,
        title: "Lead captured — Meta instant form",
        body: "Campaign: Fall Lake Getaway. Fields: name, email, phone, dates.",
        occurredAt: daysAgo(6),
      },
      {
        type: LeadEventType.EMAIL_SENT,
        channel: Channel.EMAIL,
        title: 'Email sent — "Welcome + area guide"',
        body: "Thanks for your interest in Blue Ridge Lakehouse! Here's our free local guide + live availability calendar.",
        occurredAt: daysAgo(6),
      },
      {
        type: LeadEventType.EMAIL_SENT,
        channel: Channel.EMAIL,
        title: 'Email sent — "What guests love"',
        body: "Top 3 reviews, photo tour, and how direct booking saves you 12–15% vs. the big platforms.",
        occurredAt: daysAgo(4),
      },
      {
        type: LeadEventType.REPLIED,
        title: "Replied to email",
        body: "“Is the dock private? Do you allow dogs?”",
        occurredAt: daysAgo(3, 16),
      },
      {
        type: LeadEventType.SEQUENCE_PAUSED,
        title: "Sequence paused",
        body: "Lead replied",
        occurredAt: daysAgo(3, 16),
      },
    ],
    notes: [
      {
        text: "Answered dock + pet questions. Sounds warm — send quote if she confirms dates.",
        createdAt: daysAgo(3, 17),
      },
    ],
    enroll: {
      sequenceId: s2.id,
      currentStep: 2,
      status: "PAUSED",
      pausedReason: "Lead replied",
    },
  });

  await createLeadWithTimeline({
    name: "Derek Alvarez",
    email: "derek.alvarez@yahoo.com",
    phone: "(850) 555-0177",
    source: LeadSource.DIRECT_SITE,
    propertyId: p2.id,
    stage: Stage.QUOTED,
    createdAt: daysAgo(4),
    travelDates: "Aug 14–21",
    partySize: "2 adults",
    emailConsent: true,
    smsConsent: true,
    events: [
      {
        type: LeadEventType.INQUIRY_ABANDONED,
        title: "Abandoned inquiry — Hostfully",
        body: "Started a booking for Aug 14–21, left at payment step. Contact captured from inquiry form.",
        occurredAt: daysAgo(4),
      },
      {
        type: LeadEventType.QUOTE_SENT,
        title: "Quote sent — $1,890 (7 nights)",
        body: "Sent from Hostfully, direct-booking discount applied.",
        occurredAt: daysAgo(4, 12),
      },
      {
        type: LeadEventType.SMS_SENT,
        channel: Channel.SMS,
        title: "SMS sent — Quote follow-up",
        body: "Hi Derek — just checking you got the quote for Palm Cove Condo. Happy to tweak dates or answer questions!",
        occurredAt: daysAgo(2),
      },
    ],
    enroll: { sequenceId: s3.id, currentStep: 1 },
  });

  await createLeadWithTimeline({
    name: "Priya Raman",
    email: "priya.raman@outlook.com",
    source: LeadSource.META,
    campaignId: c2.id,
    propertyId: p2.id,
    stage: Stage.NEW,
    createdAt: daysAgo(1, 9),
    travelDates: "Flexible — Sept",
    emailConsent: true,
    smsConsent: false,
    events: [
      {
        type: LeadEventType.CAPTURED,
        title: "Lead captured — Meta instant form",
        body: "Campaign: Destin Beach Week. Fields: name, email. Phone skipped (optional).",
        occurredAt: daysAgo(1, 9),
      },
      {
        type: LeadEventType.EMAIL_SENT,
        channel: Channel.EMAIL,
        title: 'Email sent — "Welcome + area guide"',
        body: "Thanks for your interest in Palm Cove Condo! Here's our free local guide + live availability calendar.",
        occurredAt: daysAgo(1, 9),
      },
    ],
    enroll: { sequenceId: s2.id, currentStep: 1 },
  });

  await createLeadWithTimeline({
    name: "Jordan & Casey Lee",
    email: "jclee.home@gmail.com",
    phone: "(615) 555-0119",
    address: "Nashville, TN",
    source: LeadSource.DIRECT_SITE,
    propertyId: p3.id,
    stage: Stage.CONTACTED,
    createdAt: daysAgo(9),
    travelDates: "Move-in Sept 1 (12-mo lease)",
    emailConsent: true,
    smsConsent: true,
    needsAttention: true,
    events: [
      {
        type: LeadEventType.INQUIRY_STARTED,
        title: "Application started — direct site",
        body: "Long-term rental application 60% complete, never submitted.",
        occurredAt: daysAgo(9),
      },
      {
        type: LeadEventType.REPLIED,
        channel: Channel.SMS,
        title: "SMS reply",
        body: "“Still interested! Waiting on job offer letter, can we talk next week?”",
        occurredAt: daysAgo(5, 15),
      },
      {
        type: LeadEventType.SEQUENCE_PAUSED,
        title: "Sequence paused",
        body: "Lead replied",
        occurredAt: daysAgo(5, 15),
      },
    ],
    enroll: {
      sequenceId: s1.id,
      currentStep: 3,
      status: "PAUSED",
      pausedReason: "Lead replied",
    },
  });

  await createLeadWithTimeline({
    name: "Sofia Marino",
    email: "sofiam.design@gmail.com",
    source: LeadSource.PINTEREST,
    campaignId: c4.id,
    propertyId: p1.id,
    stage: Stage.ENGAGED,
    createdAt: daysAgo(8),
    travelDates: "June 2027 (wedding)",
    partySize: "~14 guests",
    emailConsent: true,
    smsConsent: false,
    needsAttention: true,
    events: [
      {
        type: LeadEventType.CAPTURED,
        title: "Lead captured — Pinterest lead ad",
        body: "Campaign: Mountain Wedding Stays. Event date: June 2027.",
        occurredAt: daysAgo(8),
      },
      {
        type: LeadEventType.REPLIED,
        title: "Replied to email",
        body: "“Could we do a video tour for our wedding block?”",
        occurredAt: daysAgo(2, 11),
      },
      {
        type: LeadEventType.SEQUENCE_PAUSED,
        title: "Sequence paused",
        body: "Lead replied",
        occurredAt: daysAgo(2, 11),
      },
    ],
    enroll: {
      sequenceId: s2.id,
      currentStep: 3,
      status: "PAUSED",
      pausedReason: "Lead replied",
    },
  });

  await createLeadWithTimeline({
    name: "Marcus Webb",
    email: "mwebb88@gmail.com",
    phone: "(423) 555-0163",
    source: LeadSource.TIKTOK,
    campaignId: c3.id,
    propertyId: p1.id,
    stage: Stage.LOST,
    createdAt: daysAgo(24),
    emailConsent: true,
    smsConsent: false,
    events: [
      {
        type: LeadEventType.CAPTURED,
        title: "Lead captured — TikTok instant form",
        body: "Campaign: Cabin Tour Video.",
        occurredAt: daysAgo(24),
      },
      {
        type: LeadEventType.LOST_MARKED,
        title: "Marked lost",
        body: "Replied: booked elsewhere this year. Added to Past-Guest style re-engagement for next season.",
        occurredAt: daysAgo(12),
      },
    ],
    enroll: { sequenceId: s2.id, currentStep: 4, status: "STOPPED" },
  });

  await createLeadWithTimeline({
    name: "Aisha Bell",
    email: "aisha.bell@me.com",
    phone: "(704) 555-0141",
    source: LeadSource.META,
    campaignId: c1.id,
    propertyId: p1.id,
    stage: Stage.BOOKED,
    createdAt: daysAgo(17),
    travelDates: "Sep 18–21",
    partySize: "6 adults",
    emailConsent: true,
    smsConsent: true,
    events: [
      {
        type: LeadEventType.CAPTURED,
        title: "Lead captured — Meta instant form",
        body: "Campaign: Fall Lake Getaway.",
        occurredAt: daysAgo(17),
      },
      {
        type: LeadEventType.QUOTE_SENT,
        title: "Quote sent — $1,260 (3 nights)",
        occurredAt: daysAgo(11),
      },
      {
        type: LeadEventType.BOOKED,
        title: "Booked direct — $1,260",
        body: "Attribution: Meta ad → welcome sequence email #2. Sequence auto-stopped.",
        occurredAt: daysAgo(10),
      },
      {
        type: LeadEventType.SEQUENCE_STOPPED,
        title: "Sequence stopped",
        body: "Lead booked",
        occurredAt: daysAgo(10),
      },
    ],
    enroll: { sequenceId: s2.id, currentStep: 3, status: "STOPPED" },
    booking: {
      amountCents: 126000,
      bookedAt: daysAgo(10),
      campaignId: c1.id,
      sequenceId: s2.id,
    },
  });

  await createLeadWithTimeline({
    name: "Tom Okafor",
    email: null,
    phone: "(305) 555-0186",
    source: LeadSource.DIRECT_SITE,
    propertyId: p2.id,
    stage: Stage.NEW,
    createdAt: daysAgo(0, 8),
    travelDates: "Labor Day wknd",
    emailConsent: false,
    smsConsent: true,
    events: [
      {
        type: LeadEventType.INQUIRY_ABANDONED,
        title: "Abandoned inquiry — Hostfully",
        body: "Left phone only (email optional). SMS-first follow-up selected automatically.",
        occurredAt: daysAgo(0, 8),
      },
    ],
    enroll: { sequenceId: s1.id, currentStep: 0 },
  });

}

async function main() {
  const result = await seedDemoOrg();
  console.log(`Seeded org ${result.org.id} for ${result.email}`);
}

const isDirect =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("seed.ts") || process.argv[1].endsWith("seed.js"));

if (isDirect) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
