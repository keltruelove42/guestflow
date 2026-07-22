/**
 * Trades vertical demo dataset, services, template sequences, campaigns,
 * and leads for home-services businesses (plumbers, electricians,
 * renovators). Mirrors the rentals seed structure; all rows isDemo except
 * sequences, which are permanent templates.
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

export async function seedTradesContent(orgId: string) {
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

  // ---------- services (Property rows) ----------
  const [svc1, svc2, svc3] = await Promise.all([
    prisma.property.create({
      data: {
        orgId: org.id,
        name: "Water Heater Replacement",
        location: "Service area: metro + 30mi",
        isDemo: true,
        photoUrl: "🔥",
        knowledgeBase:
          "Tank ($1,800–$2,400 installed) and tankless ($3,200–$4,500) options. Same-week install, permit included, old unit hauled away. 6-yr parts warranty.",
      },
    }),
    prisma.property.create({
      data: {
        orgId: org.id,
        name: "Electrical Panel Upgrade",
        location: "Service area: metro + 30mi",
        isDemo: true,
        photoUrl: "⚡",
        knowledgeBase:
          "100A→200A upgrades $2,600–$3,800 incl. permit & inspection. EV-charger-ready options. 1-day job, power off ~4 hours.",
      },
    }),
    prisma.property.create({
      data: {
        orgId: org.id,
        name: "Kitchen Renovation",
        location: "Design + build",
        isDemo: true,
        photoUrl: "🍳",
        knowledgeBase:
          "Full remodels $28k–$65k, 3–6 weeks. Free in-home design consult. Financing available. Licensed & insured, 2-yr workmanship warranty.",
      },
    }),
  ]);

  // ---------- template sequences ----------
  const s1 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Missed Inquiry Rescue",
      trigger: SequenceTrigger.INQUIRY_ABANDONED,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, it's {{host_name}}, got your request and didn't want to leave you hanging. What's the best time for a quick call about the job? Or just reply here with details and I'll price it out. (Reply STOP to opt out)",
          },
          {
            order: 1,
            delayMinutes: 60,
            channel: Channel.EMAIL,
            subject: "Your estimate request: quick question",
            body: "Hi {{first_name}},\n\nThanks for reaching out about your project. To get you an accurate number fast, can you reply with:\n\n1. A photo or two of the area\n2. Rough timeline (this week? this month?)\n3. Best number to reach you\n\nMost estimates go out same day.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 2,
            delayMinutes: 1440,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}} again, still happy to get you a price on that job. Slots this week are filling; reply with a good time and I'll lock one in. (Reply STOP to opt out)",
          },
          {
            order: 3,
            delayMinutes: 4320,
            channel: Channel.EMAIL,
            subject: "Closing the loop on your project",
            body: "Hi {{first_name}},\n\nI'll assume the timing changed, no problem at all. If the project comes back around, just reply to this email and we'll pick it right up.\n\nKeep our number handy for emergencies too.\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
  });

  const s2 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "New Lead Welcome",
      trigger: SequenceTrigger.AD_LEAD_CAPTURED,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.EMAIL,
            subject: "Got your request: here's what happens next",
            body: "Hi {{first_name}},\n\nThanks for requesting a quote. Here's how we work:\n\n1. Quick call or photos to scope the job\n2. Written estimate, usually same day\n3. We schedule at your convenience; you approve before any work starts\n\nLicensed, insured, and we show up when we say we will. Reply with a couple of photos and your timeline to skip step 1.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 1,
            delayMinutes: 1440,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, it's {{host_name}}. Any dates in mind for the job? I can text you a ballpark price if you send a photo of the area. (Reply STOP to opt out)",
          },
          {
            order: 2,
            delayMinutes: 4320,
            channel: Channel.CALL,
            subject: "Call: warm lead from ad",
            body: "Call script: Confirm you're speaking with {{first_name}}. Reference their quote request. Ask: what's the problem/project, how soon, have they had other bids. Offer a firm estimate visit this week. Log outcome in notes.",
          },
          {
            order: 3,
            delayMinutes: 10080,
            channel: Channel.EMAIL,
            subject: "Still need that job done?",
            body: "Hi {{first_name}},\n\nChecking in one last time. If you're still comparing bids, I'm glad to walk through ours line by line, no pressure either way.\n\nIf now's not the time, no worries. We're here when you need us.\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
  });

  const s3 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Estimate Sent, No Answer",
      trigger: SequenceTrigger.QUOTE_UNACCEPTED_48H,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.EMAIL,
            subject: "Any questions on your estimate?",
            body: "Hi {{first_name}},\n\nWanted to make sure the estimate landed. Happy to walk through it line by line, adjust scope to fit budget, or talk financing options.\n\nOne thing worth knowing: our schedule books 1–2 weeks out, so if you'd like the work done soon, locking a date now keeps your options open.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 1,
            delayMinutes: 2880,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}} here. Any questions on the estimate? If budget's the sticking point, tell me, there's usually a way to phase the work. (Reply STOP to opt out)",
          },
          {
            order: 2,
            delayMinutes: 7200,
            channel: Channel.CALL,
            subject: "Call: estimate follow-up",
            body: "Call script: Ask if they reviewed the estimate. Listen for objections (price, timing, trust). Offer: phased scope, financing, or a small discount for booking this month. If they went elsewhere, thank them and ask what made the difference. Log outcome.",
          },
          {
            order: 3,
            delayMinutes: 20160,
            channel: Channel.EMAIL,
            subject: "Your estimate is good for 30 days",
            body: "Hi {{first_name}},\n\nJust so it doesn't sneak up on you, the estimate we sent stays valid for 30 days. After that, material prices may shift it.\n\nReply anytime and we'll get you on the schedule.\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
  });

  const s4 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Job Done: Review & Referral",
      trigger: SequenceTrigger.MANUAL_ONLY,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 1440,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, thanks again for trusting {{host_name}} with the job! If everything's working great, a quick Google review means the world to a local business: {{quote_link}} (Reply STOP to opt out)",
          },
          {
            order: 1,
            delayMinutes: 10080,
            channel: Channel.EMAIL,
            subject: "A thank-you (and $50 for you and a friend)",
            body: "Hi {{first_name}},\n\nHope everything's still running perfectly. Quick thank-you: refer a neighbor or friend and you BOTH get $50 off your next service call.\n\nJust have them mention your name when they book.\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
  });

  const s5 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Seasonal Maintenance Win-Back",
      trigger: SequenceTrigger.CHECKOUT_PLUS_90D,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.EMAIL,
            subject: "Time for your {{season}} checkup",
            body: "Hi {{first_name}},\n\nIt's been a few months since we were out, a quick seasonal check keeps small issues from becoming weekend emergencies.\n\nThis month we're running a $89 whole-home checkup for past customers (normally $149). Reply and we'll find a time.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 1,
            delayMinutes: 7200,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}}, last call on the $89 past-customer checkup this month. Want me to grab you a slot? (Reply STOP to opt out)",
          },
        ],
      },
    },
  });

  await ensureSequence({
    data: {
      orgId: org.id,
      name: "Slow Week Filler",
      trigger: SequenceTrigger.MANUAL_ONLY,
      active: false,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.EMAIL,
            subject: "Openings this week: priority scheduling",
            body: "Hi {{first_name}},\n\nA couple of slots opened up this week, and past customers get first dibs. If you've been putting off a repair or project, now's a great time, we can likely get to it within days, not weeks.\n\nReply with what you need and I'll hold a slot.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 1,
            delayMinutes: 2880,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}}, still have an opening Thursday if that repair's been on your list. Want it? (Reply STOP to opt out)",
          },
        ],
      },
    },
  });

  // ---------- campaigns ----------
  const c1 = await prisma.campaign.create({
    data: {
      orgId: org.id,
      propertyId: svc1.id,
      platform: AdPlatform.META,
      name: "Water Heater: Same-Week Install",
      status: CampaignStatus.ACTIVE,
      dailyBudgetCents: 4000,
      audience: { radiusMi: 30, age: "30-65", interests: ["Homeowners"] },
      leadForm: [
        { key: "name", label: "Name", required: true },
        { key: "phone", label: "Phone", required: true },
        { key: "timeframe", label: "How soon?", required: false },
      ],
      autoEnrollSequenceId: s2.id,
      spendCents: 68200,
      impressions: 41200,
      clicks: 890,
      leadsCount: 4,
      startedAt: daysAgo(21),
      isDemo: true,
    },
  });
  await prisma.campaign.create({
    data: {
      orgId: org.id,
      propertyId: svc2.id,
      platform: AdPlatform.META,
      name: "EV-Ready Panel Upgrade",
      status: CampaignStatus.ACTIVE,
      dailyBudgetCents: 3000,
      audience: { radiusMi: 30, interests: ["Electric vehicles", "Homeowners"] },
      leadForm: [
        { key: "name", label: "Name", required: true },
        { key: "email", label: "Email", required: true },
      ],
      autoEnrollSequenceId: s2.id,
      spendCents: 41500,
      impressions: 28750,
      clicks: 512,
      leadsCount: 2,
      startedAt: daysAgo(14),
      isDemo: true,
    },
  });
  await prisma.campaign.create({
    data: {
      orgId: org.id,
      propertyId: svc3.id,
      platform: AdPlatform.TIKTOK,
      name: "Kitchen Reno Before/After",
      status: CampaignStatus.PAUSED,
      dailyBudgetCents: 2500,
      audience: { radiusMi: 40, age: "28-55" },
      leadForm: [
        { key: "name", label: "Name", required: true },
        { key: "email", label: "Email", required: true },
      ],
      spendCents: 18900,
      impressions: 63200,
      clicks: 1210,
      leadsCount: 2,
      startedAt: daysAgo(30),
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
  for (const provider of ["tiktok", "klaviyo", "stripe", "pinterest"] as const) {
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
    serviceId?: string;
    campaignId?: string;
    stage: (typeof Stage)[keyof typeof Stage];
    createdAt: Date;
    timeframe?: string;
    detail?: string;
    emailConsent?: boolean;
    smsConsent?: boolean;
    needsAttention?: boolean;
    events: SeedEvent[];
    enroll?: { sequenceId: string; currentStep: number; status?: "ACTIVE" | "PAUSED" | "STOPPED" | "COMPLETED" };
    booking?: { amountCents: number; bookedAt: Date; campaignId?: string; sequenceId?: string };
  }) {
    const l = await prisma.lead.create({
      data: {
        orgId: org.id,
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        source: input.source,
        propertyId: input.serviceId ?? null,
        campaignId: input.campaignId ?? null,
        stage: input.stage,
        travelDates: input.timeframe ?? null,
        partySize: input.detail ?? null,
        emailConsent: input.emailConsent ?? Boolean(input.email),
        smsConsent: input.smsConsent ?? Boolean(input.phone),
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
          propertyId: input.serviceId ?? null,
          amountCents: input.booking.amountCents,
          bookedAt: input.booking.bookedAt,
          attributedCampaignId: input.booking.campaignId ?? null,
          attributedSequenceId: input.booking.sequenceId ?? null,
        },
      });
    }
    return { lead: l, enrollment: null };
  }

  const mike = await lead({
    name: "Mike Torres",
    phone: "(615) 555-0142",
    source: LeadSource.DIRECT_SITE,
    serviceId: svc1.id,
    stage: Stage.NEW,
    createdAt: daysAgo(0, 6),
    timeframe: "ASAP, no hot water",
    events: [
      {
        type: LeadEventType.INQUIRY_ABANDONED,
        title: "Started estimate request: didn't finish",
        body: "Left phone only. SMS-first rescue selected automatically.",
        occurredAt: daysAgo(0, 6),
      },
      {
        type: LeadEventType.SMS_SENT,
        channel: Channel.SMS,
        title: "SMS sent: instant text-back",
        body: "Hi Mike, it's Taylor, got your request and didn't want to leave you hanging…",
        occurredAt: daysAgo(0, 6),
      },
    ],
    enroll: { sequenceId: s1.id, currentStep: 1 },
  });
  // one pending message so the demo shows the scheduler working
  const s1step1 = s1.steps[1];
  if (mike.enrollment && s1step1) {
    await prisma.scheduledMessage.create({
      data: {
        orgId: org.id,
        enrollmentId: mike.enrollment.id,
        stepId: s1step1.id,
        channel: s1step1.channel,
        sendAt: new Date(Date.now() + 45 * 60_000),
        status: "PENDING",
        idempotencyKey: `${mike.enrollment.id}:${s1step1.id}`,
      },
    });
  }

  await lead({
    name: "Sarah Kim",
    email: "sarah.kim@example.com",
    phone: "(615) 555-0177",
    source: LeadSource.META,
    serviceId: svc1.id,
    campaignId: c1.id,
    stage: Stage.CONTACTED,
    createdAt: daysAgo(1, 4),
    timeframe: "This month",
    detail: "50-gal tank, garage install",
    events: [
      {
        type: LeadEventType.CAPTURED,
        title: "Lead captured: Meta instant form",
        occurredAt: daysAgo(1, 4),
      },
      {
        type: LeadEventType.EMAIL_SENT,
        channel: Channel.EMAIL,
        title: "Email sent: \"Got your request\"",
        occurredAt: daysAgo(1, 4),
      },
    ],
    enroll: { sequenceId: s2.id, currentStep: 1 },
  });

  await lead({
    name: "Dave & Linda Parker",
    email: "parkerfam@example.com",
    phone: "(629) 555-0110",
    source: LeadSource.MANUAL,
    serviceId: svc3.id,
    stage: Stage.QUOTED,
    createdAt: daysAgo(4),
    timeframe: "Start in ~6 weeks",
    detail: "Full kitchen, ~$45k budget",
    events: [
      {
        type: LeadEventType.QUOTE_SENT,
        title: "Estimate sent: $47,800",
        body: "Full remodel incl. cabinets, counters, electrical. 30-day validity.",
        occurredAt: daysAgo(2),
      },
      {
        type: LeadEventType.EMAIL_SENT,
        channel: Channel.EMAIL,
        title: "Email sent: \"Any questions on your estimate?\"",
        occurredAt: daysAgo(0, 20),
      },
    ],
    enroll: { sequenceId: s3.id, currentStep: 1 },
  });

  await lead({
    name: "Angela Ruiz",
    email: "angela.r@example.com",
    phone: "(615) 555-0165",
    source: LeadSource.META,
    serviceId: svc2.id,
    stage: Stage.ENGAGED,
    createdAt: daysAgo(3),
    timeframe: "Flexible",
    detail: "EV charger + 200A",
    needsAttention: true,
    events: [
      {
        type: LeadEventType.CAPTURED,
        title: "Lead captured: Meta instant form",
        occurredAt: daysAgo(3),
      },
      {
        type: LeadEventType.REPLIED,
        channel: Channel.EMAIL,
        title: "Replied to email",
        body: "\"Do you handle the permit? And can it be EV-ready for a Rivian?\"",
        occurredAt: daysAgo(0, 9),
      },
      {
        type: LeadEventType.SEQUENCE_PAUSED,
        title: "Sequence paused: human reply needed",
        occurredAt: daysAgo(0, 9),
      },
    ],
    enroll: { sequenceId: s2.id, currentStep: 2, status: "PAUSED" },
  });

  await lead({
    name: "Tom Nguyen",
    email: "tom.nguyen@example.com",
    phone: "(615) 555-0198",
    source: LeadSource.META,
    serviceId: svc1.id,
    campaignId: c1.id,
    stage: Stage.BOOKED,
    createdAt: daysAgo(9),
    timeframe: "Done last week",
    events: [
      {
        type: LeadEventType.CAPTURED,
        title: "Lead captured: Meta instant form",
        occurredAt: daysAgo(9),
      },
      {
        type: LeadEventType.BOOKED,
        title: "Job won: $2,240 water heater install",
        occurredAt: daysAgo(6),
      },
      {
        type: LeadEventType.SMS_SENT,
        channel: Channel.SMS,
        title: "SMS sent: review request",
        occurredAt: daysAgo(5),
      },
    ],
    booking: { amountCents: 224000, bookedAt: daysAgo(6), campaignId: c1.id, sequenceId: s2.id },
  });

  await lead({
    name: "Jerry Fields",
    email: "jfields@example.com",
    source: LeadSource.DIRECT_SITE,
    serviceId: svc2.id,
    stage: Stage.LOST,
    createdAt: daysAgo(12),
    events: [
      {
        type: LeadEventType.QUOTE_SENT,
        title: "Estimate sent: $3,400 panel upgrade",
        occurredAt: daysAgo(10),
      },
      {
        type: LeadEventType.LOST_MARKED,
        title: "Marked lost: went with a lower bid",
        occurredAt: daysAgo(5),
      },
    ],
  });

  await lead({
    name: "Priya Shah",
    email: "priya.shah@example.com",
    phone: "(629) 555-0133",
    source: LeadSource.TIKTOK,
    serviceId: svc3.id,
    stage: Stage.ENGAGED,
    createdAt: daysAgo(6),
    timeframe: "Spring",
    detail: "Galley kitchen, open to layout ideas",
    needsAttention: true,
    events: [
      {
        type: LeadEventType.CAPTURED,
        title: "Lead captured: TikTok form",
        occurredAt: daysAgo(6),
      },
      {
        type: LeadEventType.REPLIED,
        channel: Channel.SMS,
        title: "Replied to SMS",
        body: "\"Could we do the design consult on a Saturday?\"",
        occurredAt: daysAgo(1),
      },
    ],
    enroll: { sequenceId: s2.id, currentStep: 3, status: "PAUSED" },
  });

  await lead({
    name: "Carlos Mendez",
    phone: "(615) 555-0121",
    source: LeadSource.IMPORT,
    stage: Stage.NEW,
    createdAt: daysAgo(2),
    timeframe: "Bathroom leak, recurring",
    events: [
      {
        type: LeadEventType.IMPORTED,
        title: "Imported past inquiry",
        body: "Called in March about a recurring leak; never scheduled.",
        occurredAt: daysAgo(2),
      },
    ],
  });

  // silence unused-var lint for s4/s5 (they exist as templates)
  void s4;
  void s5;
}
