/**
 * Auto & marine dealership vertical demo dataset: inventory, template
 * sequences, campaigns, and leads for car, truck, and boat dealers.
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

export async function seedDealershipsContent(orgId: string) {
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

  // ---------- inventory ----------
  const [inv1, inv2, inv3] = await Promise.all([
    prisma.property.create({
      data: {
        orgId: org.id,
        name: "2023 Ford F-150 XLT",
        location: "New trucks",
        isDemo: true,
        photoUrl: "🛻",
        knowledgeBase:
          "SuperCrew 4x4, 2.7L EcoBoost, 12k miles. Listed $46,900. 0.9% APR for qualified buyers this month. Trade-ins welcome, instant appraisal on the lot.",
      },
    }),
    prisma.property.create({
      data: {
        orgId: org.id,
        name: "Certified Pre-Owned SUVs",
        location: "CPO lot",
        isDemo: true,
        photoUrl: "🚙",
        knowledgeBase:
          "CPO Explorer, CR-V, RAV4 in stock $24k to $34k. 172-point inspection, 7yr/100k powertrain warranty. Financing from 4.9% APR with approved credit.",
      },
    }),
    prisma.property.create({
      data: {
        orgId: org.id,
        name: "Sea Ray SPX 210",
        location: "Marine showroom",
        isDemo: true,
        photoUrl: "🛥️",
        knowledgeBase:
          "2024 SPX 210 outboard, 250hp. Listed $72,500 with trailer. On-water demos Saturdays by appointment. Winter storage first year included.",
      },
    }),
  ]);

  // ---------- template sequences ----------
  const s1 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Instant Lead Response",
      trigger: SequenceTrigger.AD_LEAD_CAPTURED,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, this is {{host_name}}. Got your inquiry, the vehicle is still available! Want to come see it today or tomorrow? I can hold it for your visit. (Reply STOP to opt out)",
          },
          {
            order: 1,
            delayMinutes: 60,
            channel: Channel.EMAIL,
            subject: "It's still available: here's everything you asked about",
            body: "Hi {{first_name}},\n\nThanks for reaching out! Quick answers up front:\n\n• Yes, it's still on the lot\n• Price includes a full inspection and history report\n• Financing takes about 10 minutes, and you can start online: {{quote_link}}\n\nHave a trade-in? Reply with the year, make, model, and rough mileage and I'll send you a real number, not a teaser.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 2,
            delayMinutes: 1440,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}} again. Still interested? These have been moving fast this month. I can set up a quick test drive whenever works, even after hours. (Reply STOP to opt out)",
          },
        ],
      },
    },
  });

  const s2 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Unfinished Credit App Rescue",
      trigger: SequenceTrigger.INQUIRY_ABANDONED,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, it's {{host_name}}. Saw your financing application didn't finish, no worries, it happens. Want me to save your progress and help you wrap it up? Takes about 5 minutes. (Reply STOP to opt out)",
          },
          {
            order: 1,
            delayMinutes: 120,
            channel: Channel.EMAIL,
            subject: "Your application is saved: finish in 5 minutes",
            body: "Hi {{first_name}},\n\nYour credit application is saved right where you left off. Pick it back up here: {{quote_link}}\n\nA few things people usually want to know first:\n\n• Applying won't lock you into anything\n• We work with 20+ lenders, so most credit situations are workable\n• You can get pre-approved before you ever set foot on the lot\n\nIf a question stopped you, just reply. I'll give you a straight answer.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 2,
            delayMinutes: 2880,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}} here. Your pre-approval window is still open. Want me to finish it with you over the phone? Two minutes, no pressure. (Reply STOP to opt out)",
          },
        ],
      },
    },
  });

  const s3 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Offer Sent, No Response",
      trigger: SequenceTrigger.QUOTE_UNACCEPTED_48H,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.EMAIL,
            subject: "Checking in on your numbers",
            body: "Hi {{first_name}},\n\nWanted to follow up on the offer we put together. Everything in it is still good: the price, your trade value, and the payment estimate.\n\nIf something didn't sit right, tell me which number and I'll see what I can do. If the timing moved, that's fine too, just let me know where you stand.\n\nReview it again here: {{quote_link}}\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 1,
            delayMinutes: 2880,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}} here. Your offer is still on the table but I can only hold the vehicle so long. Want me to keep it another 48 hours? (Reply STOP to opt out)",
          },
          {
            order: 2,
            delayMinutes: 10080,
            channel: Channel.EMAIL,
            subject: "Before I release it",
            body: "Hi {{first_name}},\n\nNo pressure either way, but I'm about to open this one back up to other buyers and wanted you to have first right of refusal.\n\nIf the deal wasn't quite right, reply and tell me what would make it work. You'd be surprised what we can do at month-end.\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
  });

  const s4 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Test Drive No-Show Recovery",
      trigger: SequenceTrigger.MANUAL_ONLY,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, it's {{host_name}}. Sorry we missed you today! Life happens. Want to grab another time this week? I'll have it pulled up front and ready. (Reply STOP to opt out)",
          },
          {
            order: 1,
            delayMinutes: 1440,
            channel: Channel.EMAIL,
            subject: "Let's find a time that actually works",
            body: "Hi {{first_name}},\n\nNo worries about yesterday. Here's my calendar, pick any slot and I'll have the vehicle ready when you pull in: {{quote_link}}\n\nEvenings and weekends work too. If you'd rather I bring it to you for a driveway test drive, we do that as well.\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
  });

  const s5 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Trade-Up Check-In",
      trigger: SequenceTrigger.CHECKOUT_PLUS_90D,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.EMAIL,
            subject: "Your trade-in is worth more than you think",
            body: "Hi {{first_name}},\n\nQuick heads up: used values are strong right now and your vehicle is in demand. A lot of our customers are upgrading with little or no change in payment.\n\nWant a no-obligation number for yours? Reply with current mileage and I'll send your updated trade value today.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 1,
            delayMinutes: 7200,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}} here. Still happy to run that trade number for you, takes me 10 minutes and it's good for 7 days. Interested? (Reply STOP to opt out)",
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
            body: "Hi {{first_name}}! Congrats again on the new ride 🎉 If you have 30 seconds, a Google review means a lot to our team: {{quote_link}} (Reply STOP to opt out)",
          },
          {
            order: 1,
            delayMinutes: 10080,
            channel: Channel.EMAIL,
            subject: "Send a friend, get $100",
            body: "Hi {{first_name}},\n\nA thank-you from us: refer a friend and you get a $100 gift card when they buy, and they get VIP treatment start to finish. They just mention your name.\n\nEnjoy the new wheels!\n\n{{host_name}}{{unsub_link}}",
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
      name: "F-150 Month-End: 0.9% APR",
      status: CampaignStatus.ACTIVE,
      dailyBudgetCents: 4000,
      audience: { radiusMi: 40, age: "25-65", interests: ["Trucks", "Ford"] },
      leadForm: [
        { key: "name", label: "Name", required: true },
        { key: "phone", label: "Phone", required: true },
        { key: "tradein", label: "Do you have a trade-in?", required: false },
      ],
      autoEnrollSequenceId: s1.id,
      spendCents: 52300,
      impressions: 91400,
      clicks: 1870,
      leadsCount: 3,
      startedAt: daysAgo(16),
      isDemo: true,
    },
  });
  await prisma.campaign.create({
    data: {
      orgId: org.id,
      propertyId: inv2.id,
      platform: AdPlatform.META,
      name: "CPO SUVs Under $30k",
      status: CampaignStatus.ACTIVE,
      dailyBudgetCents: 3000,
      audience: { radiusMi: 30, age: "25-60" },
      leadForm: [
        { key: "name", label: "Name", required: true },
        { key: "email", label: "Email", required: true },
      ],
      autoEnrollSequenceId: s1.id,
      spendCents: 28700,
      impressions: 64100,
      clicks: 1240,
      leadsCount: 2,
      startedAt: daysAgo(11),
      isDemo: true,
    },
  });
  await prisma.campaign.create({
    data: {
      orgId: org.id,
      propertyId: inv3.id,
      platform: AdPlatform.TIKTOK,
      name: "Summer on the Water: SPX 210",
      status: CampaignStatus.PAUSED,
      dailyBudgetCents: 2500,
      audience: { radiusMi: 60, age: "30-60" },
      leadForm: [
        { key: "name", label: "Name", required: true },
        { key: "email", label: "Email", required: true },
      ],
      spendCents: 14200,
      impressions: 51900,
      clicks: 830,
      leadsCount: 1,
      startedAt: daysAgo(22),
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
  for (const provider of ["klaviyo", "stripe", "tiktok"] as const) {
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
    vehicleId?: string;
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
        propertyId: input.vehicleId ?? null,
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
          propertyId: input.vehicleId ?? null,
          amountCents: input.booking.amountCents,
          bookedAt: input.booking.bookedAt,
          attributedCampaignId: input.booking.campaignId ?? null,
          attributedSequenceId: input.booking.sequenceId ?? null,
        },
      });
    }
    return { lead: l, enrollment: null };
  }

  const marcus = await lead({
    name: "Marcus Webb",
    phone: "(704) 555-0231",
    source: LeadSource.DIRECT_SITE,
    vehicleId: inv1.id,
    stage: Stage.NEW,
    createdAt: daysAgo(0, 3),
    timeframe: "This month",
    detail: "Trade-in: 2018 Silverado, ~80k mi",
    events: [
      {
        type: LeadEventType.INQUIRY_ABANDONED,
        title: "Started credit application: didn't finish",
        body: "Got through income step, dropped off at the co-signer question. Phone only.",
        occurredAt: daysAgo(0, 3),
      },
      {
        type: LeadEventType.SMS_SENT,
        channel: Channel.SMS,
        title: "SMS sent: save-your-progress text",
        occurredAt: daysAgo(0, 3),
      },
    ],
    enroll: { sequenceId: s2.id, currentStep: 1 },
  });
  const s2step1 = s2.steps[1];
  if (marcus.enrollment && s2step1) {
    await prisma.scheduledMessage.create({
      data: {
        orgId: org.id,
        enrollmentId: marcus.enrollment.id,
        stepId: s2step1.id,
        channel: s2step1.channel,
        sendAt: new Date(Date.now() + 90 * 60_000),
        status: "PENDING",
        idempotencyKey: `${marcus.enrollment.id}:${s2step1.id}`,
      },
    });
  }

  await lead({
    name: "Alicia Grant",
    email: "alicia.grant@example.com",
    phone: "(980) 555-0212",
    source: LeadSource.META,
    vehicleId: inv1.id,
    campaignId: c1.id,
    stage: Stage.CONTACTED,
    createdAt: daysAgo(1, 1),
    timeframe: "Next 2 weeks",
    detail: "Wants 4x4, asking about 0.9% APR",
    events: [
      { type: LeadEventType.CAPTURED, title: "Lead captured: Meta instant form", occurredAt: daysAgo(1, 1) },
      { type: LeadEventType.SMS_SENT, channel: Channel.SMS, title: "SMS sent: instant response text", occurredAt: daysAgo(1, 1) },
    ],
    enroll: { sequenceId: s1.id, currentStep: 1 },
  });

  await lead({
    name: "Derek Holloway",
    email: "derek.h@example.com",
    phone: "(704) 555-0298",
    source: LeadSource.DIRECT_SITE,
    vehicleId: inv2.id,
    stage: Stage.QUOTED,
    createdAt: daysAgo(4),
    timeframe: "Flexible",
    detail: "CPO Explorer, financing + trade",
    events: [
      { type: LeadEventType.CAPTURED, title: "Inquiry: website contact form", occurredAt: daysAgo(4) },
      {
        type: LeadEventType.QUOTE_SENT,
        title: "Offer sent: 2022 Explorer XLT",
        body: "$31,400 out the door, $9,200 trade allowance, est. $412/mo at 60 months.",
        occurredAt: daysAgo(2),
      },
    ],
    enroll: { sequenceId: s3.id, currentStep: 1 },
  });

  await lead({
    name: "Renee Castillo",
    email: "renee.c@example.com",
    phone: "(980) 555-0246",
    source: LeadSource.META,
    vehicleId: inv2.id,
    stage: Stage.ENGAGED,
    createdAt: daysAgo(2),
    timeframe: "This weekend",
    detail: "CR-V or RAV4, under $30k",
    needsAttention: true,
    events: [
      { type: LeadEventType.CAPTURED, title: "Lead captured: Meta instant form", occurredAt: daysAgo(2) },
      {
        type: LeadEventType.REPLIED,
        channel: Channel.SMS,
        title: "Replied to SMS",
        body: "\"Can I see both back to back Saturday morning? And what's my Accord worth?\"",
        occurredAt: daysAgo(0, 6),
      },
      { type: LeadEventType.SEQUENCE_PAUSED, title: "Sequence paused: human reply needed", occurredAt: daysAgo(0, 6) },
    ],
    enroll: { sequenceId: s1.id, currentStep: 2, status: "PAUSED" },
  });

  await lead({
    name: "Tom Brennan",
    email: "tom.brennan@example.com",
    phone: "(704) 555-0277",
    source: LeadSource.META,
    vehicleId: inv1.id,
    campaignId: c1.id,
    stage: Stage.BOOKED,
    createdAt: daysAgo(9),
    timeframe: "Bought last week",
    events: [
      { type: LeadEventType.CAPTURED, title: "Lead captured: Meta instant form", occurredAt: daysAgo(9) },
      { type: LeadEventType.BOOKED, title: "Sold: F-150 XLT, $46,100", occurredAt: daysAgo(5) },
      { type: LeadEventType.SMS_SENT, channel: Channel.SMS, title: "SMS sent: review request", occurredAt: daysAgo(4) },
    ],
    booking: { amountCents: 4610000, bookedAt: daysAgo(5), campaignId: c1.id, sequenceId: s1.id },
  });

  await lead({
    name: "Gail Whitfield",
    email: "gail.w@example.com",
    source: LeadSource.TIKTOK,
    vehicleId: inv3.id,
    stage: Stage.CONTACTED,
    createdAt: daysAgo(3),
    timeframe: "Before July 4th",
    detail: "First boat, asking about storage",
    events: [
      { type: LeadEventType.CAPTURED, title: "Lead captured: TikTok form", occurredAt: daysAgo(3) },
      { type: LeadEventType.EMAIL_SENT, channel: Channel.EMAIL, title: "Email sent: instant response", occurredAt: daysAgo(3) },
    ],
    enroll: { sequenceId: s1.id, currentStep: 1 },
  });

  await lead({
    name: "Victor Osei",
    phone: "(980) 555-0263",
    source: LeadSource.IMPORT,
    vehicleId: inv2.id,
    stage: Stage.NEW,
    createdAt: daysAgo(1),
    timeframe: "Bought 2021 Escape here, 3 years ago",
    events: [
      {
        type: LeadEventType.IMPORTED,
        title: "Imported past customer",
        body: "Purchased in 2023, financing matures next year. Strong trade-up candidate.",
        occurredAt: daysAgo(1),
      },
    ],
    enroll: { sequenceId: s5.id, currentStep: 0 },
  });

  await lead({
    name: "Sandra Kim",
    email: "sandra.kim@example.com",
    source: LeadSource.DIRECT_SITE,
    vehicleId: inv1.id,
    stage: Stage.LOST,
    createdAt: daysAgo(12),
    events: [
      { type: LeadEventType.INQUIRY_STARTED, title: "Inquiry: F-150 test drive request", occurredAt: daysAgo(12) },
      { type: LeadEventType.LOST_MARKED, title: "Marked lost: bought a Tundra elsewhere", occurredAt: daysAgo(7) },
    ],
  });

  void s4;
}
