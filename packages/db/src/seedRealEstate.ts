/**
 * Real estate vertical demo dataset: listings, template sequences,
 * campaigns, and leads for residential agents and teams.
 * All rows isDemo except sequences (permanent templates).
 */
import {
  AdPlatform,
  CampaignStatus,
  Channel,
  IntegrationStatus,
  LeadEventType,
  LeadSource,
  SequenceTrigger,
  Stage,
  prisma,
} from "./client";

function daysAgo(days: number, hours = 0): Date {
  return new Date(Date.now() - days * 864e5 - hours * 36e5);
}

export async function seedRealEstateContent(orgId: string) {
  const org = { id: orgId };

  async function ensureSequence(args: { data: Record<string, unknown> }) {
    const existing = await prisma.sequence.findFirst({
      where: { orgId: org.id, name: args.data.name as string, isDemo: true },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    if (existing) return existing;
    return prisma.sequence.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: args.data as any,
      include: { steps: { orderBy: { order: "asc" } } },
    });
  }

  // ---------- listings ----------
  const [inv1, inv2, inv3] = await Promise.all([
    prisma.property.create({
      data: {
        orgId: org.id,
        name: "412 Maple Grove Ln",
        location: "Single family",
        isDemo: true,
        photoUrl: "🏡",
        knowledgeBase:
          "4bd/3ba, 2,650 sqft on a quarter acre. Listed $489,000. Open house Saturdays 11am to 1pm. Sellers are motivated and will review all offers. Roof replaced 2023, fenced backyard.",
      },
    }),
    prisma.property.create({
      data: {
        orgId: org.id,
        name: "The Wilder Lofts #204",
        location: "Downtown condo",
        isDemo: true,
        photoUrl: "🏙️",
        knowledgeBase:
          "2bd/2ba corner unit, 1,180 sqft. Listed $312,000. HOA $280/mo covers water, trash, gym, and rooftop deck. Pet friendly building, one deeded garage spot.",
      },
    }),
    prisma.property.create({
      data: {
        orgId: org.id,
        name: "Lakeview Parcel, 2.1 ac",
        location: "Land",
        isDemo: true,
        photoUrl: "🌲",
        knowledgeBase:
          "2.1 acres with seasonal lake views. Listed $145,000. Utilities at the street, perc test on file. Owner financing possible with 20% down. No HOA, light deed restrictions.",
      },
    }),
  ]);

  // ---------- template sequences ----------
  const s1 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "New Inquiry Instant Response",
      trigger: SequenceTrigger.AD_LEAD_CAPTURED,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, this is {{host_name}} with {{business_name}}. Got your inquiry on {{property}}, the home is still available, want to see it this week? I can set up a private showing. (Reply STOP to opt out)",
          },
          {
            order: 1,
            delayMinutes: 60,
            channel: Channel.EMAIL,
            subject: "Everything on {{property}}: photos, disclosures, and more",
            body: "Hi {{first_name}},\n\nThanks for reaching out about {{property}}! Here is everything in one place:\n\n• Full photo gallery and floor plan: {{quote_link}}\n• Seller disclosures and inspection history, available on request\n• A few similar listings nearby in case this one gets scooped up\n\nIf you want to walk it in person, reply with a day and time and I will make it happen.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 2,
            delayMinutes: 1440,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}} again. I have two showing slots open for {{property}}: Thursday at 5:30pm or Saturday at 10am. Want me to hold one for you? (Reply STOP to opt out)",
          },
        ],
      },
    },
  });

  const s2 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Unfinished Inquiry Rescue",
      trigger: SequenceTrigger.INQUIRY_ABANDONED,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, it's {{host_name}}. Saw you were checking out {{property}}, any questions I can answer? Happy to send more photos or the disclosure packet, no pressure. (Reply STOP to opt out)",
          },
          {
            order: 1,
            delayMinutes: 120,
            channel: Channel.EMAIL,
            subject: "The details most buyers ask about {{property}}",
            body: "Hi {{first_name}},\n\nSince you were looking at {{property}}, here is what most buyers want to know first:\n\n• Neighborhood: schools, commute times, and what is walkable\n• Pricing: how the list price compares to recent sales on the street\n• Next steps: you can tour first and worry about financing after\n\nFull details here: {{quote_link}}\n\nReply with any question at all, I answer fast.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 2,
            delayMinutes: 2880,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}} here. Still thinking about {{property}}? Showings are picking up this {{season}}, so if you want a look before the weekend just say the word. (Reply STOP to opt out)",
          },
        ],
      },
    },
  });

  const s3 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Showing Follow-Up",
      trigger: SequenceTrigger.QUOTE_UNACCEPTED_48H,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.EMAIL,
            subject: "Thoughts after the showing?",
            body: "Hi {{first_name}},\n\nGreat walking {{property}} with you. Curious where it landed for you.\n\nTo help you think it through, I pulled three comparable sales from the last 90 days: all closed within 2% of asking. Full comp sheet here: {{quote_link}}\n\nIf it is a maybe, tell me what is giving you pause. If it is a no, that is useful too, I will line up better fits.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 1,
            delayMinutes: 2880,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}} here. Heads up: another buyer is scheduling a second look at {{property}}. If you are leaning yes, let's talk numbers today. (Reply STOP to opt out)",
          },
          {
            order: 2,
            delayMinutes: 10080,
            channel: Channel.EMAIL,
            subject: "No rush, but the market moves",
            body: "Hi {{first_name}},\n\nNo pressure from me, timing has to be right. A quick note though: homes like {{property}} in this price band have been going under contract in about 12 days.\n\nIf this one is not the one, reply with what you would change: more bedrooms, different area, lower payment. I will build you a fresh shortlist this week.\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
  });

  const s4 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Open House Follow-Up",
      trigger: SequenceTrigger.MANUAL_ONLY,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}} here. Thanks for coming by the open house at {{property}} today! Here is the disclosure packet and floor plan: {{quote_link}}. Any questions, just reply. (Reply STOP to opt out)",
          },
          {
            order: 1,
            delayMinutes: 1440,
            channel: Channel.EMAIL,
            subject: "If you liked {{property}}, you will want to see these",
            body: "Hi {{first_name}},\n\nGreat meeting you at the open house. Whether or not {{property}} is the one, I pulled a few similar homes that just hit the market: same style, same school zone, similar price.\n\nSee the list here: {{quote_link}}\n\nWant a private tour of any of them? Reply and I will set it up around your schedule.\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
  });

  const s5 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Past Client Check-In",
      trigger: SequenceTrigger.CHECKOUT_PLUS_90D,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.EMAIL,
            subject: "How is the new place treating you?",
            body: "Hi {{first_name}},\n\nJust checking in, how is the new place? I hope you are settled and the boxes are long gone.\n\nTwo things I can do for you anytime, free of charge:\n\n• A current home value update, values in your area have been moving\n• Contractor and handyman referrals from my trusted list\n\nWant either? Just reply.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 1,
            delayMinutes: 7200,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}} here. That home value update is a 10 minute job on my end and kind of fun to see. Want me to run the numbers for you this week? (Reply STOP to opt out)",
          },
        ],
      },
    },
  });

  await ensureSequence({
    data: {
      orgId: org.id,
      name: "Review & Referral",
      trigger: SequenceTrigger.MANUAL_ONLY,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 1440,
            channel: Channel.SMS,
            body: "Hi {{first_name}}! Congrats again on closing 🎉 If you have 30 seconds, a Google review means the world to a local agent: {{quote_link}} (Reply STOP to opt out)",
          },
          {
            order: 1,
            delayMinutes: 10080,
            channel: Channel.EMAIL,
            subject: "Know anyone moving?",
            body: "Hi {{first_name}},\n\nOne small ask: if you know anyone thinking about buying or selling, I would love an introduction. I treat referrals like family, they get my direct line, first looks at new listings, and zero runaround.\n\nThanks again for trusting me with your move. Enjoy the new home!\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
  });

  // ---------- campaigns ----------
  const c1 = await prisma.campaign.create({
    data: {
      orgId: org.id,
      propertyId: inv1.id,
      platform: AdPlatform.META,
      name: "Just Listed: Maple Grove",
      status: CampaignStatus.ACTIVE,
      dailyBudgetCents: 3000,
      audience: { radiusMi: 25, age: "28-65", interests: ["Real estate", "Zillow"] },
      leadForm: [
        { key: "name", label: "Name", required: true },
        { key: "phone", label: "Phone", required: true },
        { key: "preapproved", label: "Are you pre-approved?", required: false },
      ],
      autoEnrollSequenceId: s1.id,
      spendCents: 41200,
      impressions: 78600,
      clicks: 1540,
      leadsCount: 3,
      startedAt: daysAgo(14),
      isDemo: true,
    },
  });
  const c2 = await prisma.campaign.create({
    data: {
      orgId: org.id,
      propertyId: inv2.id,
      platform: AdPlatform.META,
      name: "Downtown Loft Life",
      status: CampaignStatus.ACTIVE,
      dailyBudgetCents: 2500,
      audience: { radiusMi: 15, age: "25-45", interests: ["Condos", "City living"] },
      leadForm: [
        { key: "name", label: "Name", required: true },
        { key: "email", label: "Email", required: true },
      ],
      autoEnrollSequenceId: s1.id,
      spendCents: 23400,
      impressions: 55200,
      clicks: 1080,
      leadsCount: 2,
      startedAt: daysAgo(10),
      isDemo: true,
    },
  });
  await prisma.campaign.create({
    data: {
      orgId: org.id,
      propertyId: inv3.id,
      platform: AdPlatform.PINTEREST,
      name: "Dream Home Boards",
      status: CampaignStatus.PAUSED,
      dailyBudgetCents: 1500,
      audience: { radiusMi: 50, age: "30-60", interests: ["Home decor", "Land"] },
      leadForm: [
        { key: "name", label: "Name", required: true },
        { key: "email", label: "Email", required: true },
      ],
      spendCents: 9800,
      impressions: 43700,
      clicks: 620,
      leadsCount: 1,
      startedAt: daysAgo(21),
      isDemo: true,
    },
  });

  // ---------- integrations (idempotent) ----------
  for (const provider of ["meta", "twilio"] as const) {
    await prisma.integration.upsert({
      where: { orgId_provider: { orgId: org.id, provider } },
      update: { status: IntegrationStatus.CONNECTED, isDemo: true, lastSyncAt: daysAgo(0, 1) },
      create: {
        orgId: org.id,
        provider,
        status: IntegrationStatus.CONNECTED,
        isDemo: true,
        lastSyncAt: daysAgo(0, 1),
      },
    });
  }
  for (const provider of ["klaviyo", "stripe", "pinterest"] as const) {
    await prisma.integration.upsert({
      where: { orgId_provider: { orgId: org.id, provider } },
      update: {},
      create: { orgId: org.id, provider, status: IntegrationStatus.DISCONNECTED, isDemo: true },
    });
  }

  // ---------- leads with timelines ----------
  type SeedEvent = {
    type: (typeof LeadEventType)[keyof typeof LeadEventType];
    channel?: (typeof Channel)[keyof typeof Channel];
    title: string;
    body?: string;
    occurredAt: Date;
  };

  async function lead(input: {
    name: string;
    email?: string | null;
    phone?: string | null;
    source: (typeof LeadSource)[keyof typeof LeadSource];
    listingId?: string;
    campaignId?: string;
    stage: (typeof Stage)[keyof typeof Stage];
    createdAt: Date;
    timeframe?: string;
    detail?: string;
    needsAttention?: boolean;
    events: SeedEvent[];
    enroll?: {
      sequenceId: string;
      currentStep: number;
      status?: "ACTIVE" | "PAUSED" | "STOPPED" | "COMPLETED";
    };
    booking?: { amountCents: number; bookedAt: Date; campaignId?: string; sequenceId?: string };
  }) {
    const l = await prisma.lead.create({
      data: {
        orgId: org.id,
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        source: input.source,
        propertyId: input.listingId ?? null,
        campaignId: input.campaignId ?? null,
        stage: input.stage,
        travelDates: input.timeframe ?? null,
        partySize: input.detail ?? null,
        emailConsent: Boolean(input.email),
        smsConsent: Boolean(input.phone),
        emailConsentAt: input.email ? input.createdAt : null,
        smsConsentAt: input.phone ? input.createdAt : null,
        needsAttention: input.needsAttention ?? false,
        isDemo: true,
        createdAt: input.createdAt,
      },
    });
    for (const ev of input.events) {
      await prisma.leadEvent.create({
        data: {
          orgId: org.id,
          leadId: l.id,
          type: ev.type,
          channel: ev.channel ?? null,
          title: ev.title,
          body: ev.body ?? null,
          occurredAt: ev.occurredAt,
        },
      });
    }
    if (input.enroll) {
      const enr = await prisma.enrollment.create({
        data: {
          orgId: org.id,
          leadId: l.id,
          sequenceId: input.enroll.sequenceId,
          status: input.enroll.status ?? "ACTIVE",
          currentStep: input.enroll.currentStep,
          createdAt: input.createdAt,
        },
      });
      return { lead: l, enrollment: enr };
    }
    if (input.booking) {
      await prisma.booking.create({
        data: {
          orgId: org.id,
          leadId: l.id,
          propertyId: input.listingId ?? null,
          amountCents: input.booking.amountCents,
          bookedAt: input.booking.bookedAt,
          attributedCampaignId: input.booking.campaignId ?? null,
          attributedSequenceId: input.booking.sequenceId ?? null,
        },
      });
    }
    return { lead: l, enrollment: null };
  }

  const jordan = await lead({
    name: "Jordan Ellery",
    phone: "(919) 555-0184",
    source: LeadSource.DIRECT_SITE,
    listingId: inv1.id,
    stage: Stage.NEW,
    createdAt: daysAgo(0, 3),
    timeframe: "Pre-approved, buying in 60 days",
    detail: "Budget $450-500k, needs 4bd",
    events: [
      {
        type: LeadEventType.INQUIRY_ABANDONED,
        title: "Started listing inquiry: didn't finish",
        body: "Viewed 14 photos and opened the disclosure page, dropped off at the contact form. Phone only.",
        occurredAt: daysAgo(0, 3),
      },
      {
        type: LeadEventType.SMS_SENT,
        channel: Channel.SMS,
        title: "SMS sent: any-questions text",
        occurredAt: daysAgo(0, 3),
      },
    ],
    enroll: { sequenceId: s2.id, currentStep: 1 },
  });
  const s2step1 = s2.steps[1];
  if (jordan.enrollment && s2step1) {
    await prisma.scheduledMessage.create({
      data: {
        orgId: org.id,
        enrollmentId: jordan.enrollment.id,
        stepId: s2step1.id,
        channel: s2step1.channel,
        sendAt: new Date(Date.now() + 90 * 60_000),
        status: "PENDING",
        idempotencyKey: `${jordan.enrollment.id}:${s2step1.id}`,
      },
    });
  }

  await lead({
    name: "Priya Nandakumar",
    email: "priya.n@example.com",
    phone: "(984) 555-0139",
    source: LeadSource.IMPORT,
    listingId: inv1.id,
    stage: Stage.NEW,
    createdAt: daysAgo(1),
    timeframe: "Casually looking, 6 months",
    detail: "Open house signin, current renter",
    events: [
      {
        type: LeadEventType.IMPORTED,
        title: "Imported: open house sign-in sheet",
        body: "Signed in at the Maple Grove open house last Saturday. Asked about the school district and backyard.",
        occurredAt: daysAgo(1),
      },
    ],
    enroll: { sequenceId: s4.id, currentStep: 0 },
  });

  await lead({
    name: "Caleb Fontaine",
    email: "caleb.fontaine@example.com",
    phone: "(919) 555-0227",
    source: LeadSource.META,
    listingId: inv1.id,
    campaignId: c1.id,
    stage: Stage.CONTACTED,
    createdAt: daysAgo(1, 2),
    timeframe: "Pre-approved, buying in 90 days",
    detail: "Relocating for work, needs a yard for two dogs",
    events: [
      { type: LeadEventType.CAPTURED, title: "Lead captured: Meta instant form", occurredAt: daysAgo(1, 2) },
      { type: LeadEventType.SMS_SENT, channel: Channel.SMS, title: "SMS sent: instant response text", occurredAt: daysAgo(1, 2) },
    ],
    enroll: { sequenceId: s1.id, currentStep: 1 },
  });

  await lead({
    name: "Mara Osterberg",
    email: "mara.osterberg@example.com",
    source: LeadSource.META,
    listingId: inv2.id,
    campaignId: c2.id,
    stage: Stage.CONTACTED,
    createdAt: daysAgo(2, 4),
    timeframe: "First-time buyer, this quarter",
    detail: "Budget $300-330k, has a cat, wants walkability",
    events: [
      { type: LeadEventType.CAPTURED, title: "Lead captured: Meta instant form", occurredAt: daysAgo(2, 4) },
      { type: LeadEventType.EMAIL_SENT, channel: Channel.EMAIL, title: "Email sent: photos and disclosures", occurredAt: daysAgo(2, 4) },
    ],
    enroll: { sequenceId: s1.id, currentStep: 2 },
  });

  await lead({
    name: "Denise Whitaker",
    email: "denise.w@example.com",
    phone: "(984) 555-0271",
    source: LeadSource.META,
    listingId: inv1.id,
    campaignId: c1.id,
    stage: Stage.ENGAGED,
    createdAt: daysAgo(2),
    timeframe: "Ready now, lease ends next month",
    detail: "Cash-heavy down payment, wants Maple Grove area",
    needsAttention: true,
    events: [
      { type: LeadEventType.CAPTURED, title: "Lead captured: Meta instant form", occurredAt: daysAgo(2) },
      {
        type: LeadEventType.REPLIED,
        channel: Channel.SMS,
        title: "Replied to SMS",
        body: "\"can we see it Sunday at 2?\"",
        occurredAt: daysAgo(0, 5),
      },
      { type: LeadEventType.SEQUENCE_PAUSED, title: "Sequence paused: human reply needed", occurredAt: daysAgo(0, 5) },
    ],
    enroll: { sequenceId: s1.id, currentStep: 2, status: "PAUSED" },
  });

  await lead({
    name: "Owen Castellanos",
    email: "owen.c@example.com",
    phone: "(919) 555-0248",
    source: LeadSource.DIRECT_SITE,
    listingId: inv2.id,
    stage: Stage.QUOTED,
    createdAt: daysAgo(5),
    timeframe: "Pre-approved, buying in 30 days",
    detail: "Downsizing from a townhome, wants low maintenance",
    events: [
      { type: LeadEventType.CAPTURED, title: "Inquiry: website contact form", occurredAt: daysAgo(5) },
      {
        type: LeadEventType.QUOTE_SENT,
        title: "Showing scheduled: Saturday 11am",
        body: "Private showing of The Wilder Lofts #204, buyer bringing partner. Comp sheet and HOA docs sent ahead.",
        occurredAt: daysAgo(3),
      },
    ],
    enroll: { sequenceId: s3.id, currentStep: 1 },
  });

  await lead({
    name: "Harriet Boland",
    email: "harriet.boland@example.com",
    phone: "(984) 555-0295",
    source: LeadSource.META,
    listingId: inv1.id,
    campaignId: c1.id,
    stage: Stage.BOOKED,
    createdAt: daysAgo(12),
    timeframe: "Closed, moving next month",
    events: [
      { type: LeadEventType.CAPTURED, title: "Lead captured: Meta instant form", occurredAt: daysAgo(12) },
      { type: LeadEventType.BOOKED, title: "Under contract: 412 Maple Grove", occurredAt: daysAgo(4) },
      { type: LeadEventType.SMS_SENT, channel: Channel.SMS, title: "SMS sent: review request", occurredAt: daysAgo(3) },
    ],
    booking: { amountCents: 1467000, bookedAt: daysAgo(4), campaignId: c1.id, sequenceId: s1.id },
  });

  await lead({
    name: "Felix Trammell",
    email: "felix.t@example.com",
    source: LeadSource.DIRECT_SITE,
    listingId: inv3.id,
    stage: Stage.LOST,
    createdAt: daysAgo(15),
    events: [
      { type: LeadEventType.INQUIRY_STARTED, title: "Inquiry: Lakeview Parcel owner financing question", occurredAt: daysAgo(15) },
      { type: LeadEventType.LOST_MARKED, title: "Marked lost: went with another agent", occurredAt: daysAgo(8) },
    ],
  });

  void s5;
}
