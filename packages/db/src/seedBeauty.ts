/**
 * Beauty & wellness vertical demo dataset, services, template sequences,
 * campaigns, and leads for salons, nail studios, and massage practices.
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

export async function seedBeautyContent(orgId: string) {
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

  // ---------- services ----------
  const [svc1, svc2, svc3] = await Promise.all([
    prisma.property.create({
      data: {
        orgId: org.id,
        name: "Balayage & Color",
        location: "Hair studio",
        isDemo: true,
        photoUrl: "🎨",
        knowledgeBase:
          "Balayage $180–$260, full color $120–$180, gloss add-on $40. 2.5–3.5 hrs. New color clients need a quick consult (photos are fine). 48-hr cancellation policy.",
      },
    }),
    prisma.property.create({
      data: {
        orgId: org.id,
        name: "Gel Manicure",
        location: "Nail bar",
        isDemo: true,
        photoUrl: "💅",
        knowledgeBase:
          "Gel mani $55, gel-x extensions $85, removal $15. 60–90 min. Art by quote. Sundays book out 2 weeks ahead.",
      },
    }),
    prisma.property.create({
      data: {
        orgId: org.id,
        name: "90-Min Deep Tissue",
        location: "Wellness room",
        isDemo: true,
        photoUrl: "💆",
        knowledgeBase:
          "90-min deep tissue $145, 60-min $105. Memberships save 15%. Intake form required for first visit. 24-hr cancellation policy.",
      },
    }),
  ]);

  // ---------- template sequences ----------
  const s1 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Unfinished Booking Rescue",
      trigger: SequenceTrigger.INQUIRY_ABANDONED,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.SMS,
            body: "Hi {{first_name}}! It's {{host_name}}, saw you started booking and didn't finish. Want me to hold that time for you? Reply here and I'll lock it in. (Reply STOP to opt out)",
          },
          {
            order: 1,
            delayMinutes: 120,
            channel: Channel.EMAIL,
            subject: "Your appointment is one tap away",
            body: "Hi {{first_name}},\n\nYour booking didn't quite finish, happens all the time! Here's the quick link to pick your time: {{quote_link}}\n\nIf you had a question first (pricing, how long it takes, which service fits), just reply. I answer fast.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 2,
            delayMinutes: 1440,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}} again 💛 This week's slots are going quick, want me to grab you one? (Reply STOP to opt out)",
          },
        ],
      },
    },
  });

  const s2 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "New Client Welcome",
      trigger: SequenceTrigger.AD_LEAD_CAPTURED,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.EMAIL,
            subject: "So glad you found us: here's the scoop",
            body: "Hi {{first_name}},\n\nThanks for reaching out! Quick intro:\n\n• First visits start with a 5-min chat so we nail exactly what you want\n• You can text us anytime, this number goes straight to me\n• New clients get 15% off their first service this month\n\nReply with what you're thinking (inspo pics welcome!) or book straight in: {{quote_link}}\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 1,
            delayMinutes: 1440,
            channel: Channel.SMS,
            body: "Hi {{first_name}}! It's {{host_name}}. Any questions before you book? If you send an inspo pic I can tell you price + time right here. (Reply STOP to opt out)",
          },
          {
            order: 2,
            delayMinutes: 4320,
            channel: Channel.EMAIL,
            subject: "Your 15% new-client perk expires soon",
            body: "Hi {{first_name}},\n\nJust a heads up, the 15% first-visit perk wraps up at the end of the month, and my book fills about a week out.\n\nGrab a time here: {{quote_link}}\n\nNo pressure at all, happy to answer anything first.\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
  });

  const s3 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Consult Offered, No Booking",
      trigger: SequenceTrigger.QUOTE_UNACCEPTED_48H,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.EMAIL,
            subject: "Ready when you are 💛",
            body: "Hi {{first_name}},\n\nWanted to follow up on the consult we talked about. Big changes (color corrections, extensions, first-time work) always start with a quick consult so there are zero surprises on price or time.\n\nIt's free and takes 10 minutes, reply with a day that works and I'll fit you in.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 1,
            delayMinutes: 2880,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}} here! Still thinking it over? Send me a pic of what you're going for and I'll give you a straight answer on price + time. (Reply STOP to opt out)",
          },
          {
            order: 2,
            delayMinutes: 10080,
            channel: Channel.EMAIL,
            subject: "Whenever you're ready",
            body: "Hi {{first_name}},\n\nNo rush at all, timing has to be right for something you'll look at in the mirror every day 🙂\n\nWhen you're ready, this link books your consult in 30 seconds: {{quote_link}}\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
  });

  const s4 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Rebook Reminder (6 weeks)",
      trigger: SequenceTrigger.CHECKOUT_PLUS_90D,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.SMS,
            body: "Hi {{first_name}}! It's {{host_name}}, it's about that time 🗓️ Your usual spot is open next week. Want me to pencil you in? (Reply STOP to opt out)",
          },
          {
            order: 1,
            delayMinutes: 4320,
            channel: Channel.EMAIL,
            subject: "Your chair misses you",
            body: "Hi {{first_name}},\n\nIt's been about six weeks, right on schedule for your next visit. Regulars who pre-book get first pick of evening and weekend slots.\n\nBook here: {{quote_link}} or just reply with a day that works.\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
  });

  const s5 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "We Miss You Win-Back",
      trigger: SequenceTrigger.MANUAL_ONLY,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.EMAIL,
            subject: "It's been a while: come back for 20% off",
            body: "Hi {{first_name}},\n\nIt's been a few months and I'd love to see you back in the chair. Here's 20% off your next visit, no strings, just mention this email.\n\nBook anytime: {{quote_link}}\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 1,
            delayMinutes: 7200,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}} 💛 Your 20% welcome-back perk is waiting, want me to find you a time this week? (Reply STOP to opt out)",
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
            body: "Hi {{first_name}}! So glad you loved it 🥰 If you have 30 seconds, a Google review helps my little business so much: {{quote_link}} (Reply STOP to opt out)",
          },
          {
            order: 1,
            delayMinutes: 10080,
            channel: Channel.EMAIL,
            subject: "Bring a friend: you both get $20 off",
            body: "Hi {{first_name}},\n\nA little thank-you: refer a friend and you EACH get $20 off your next appointment. They just mention your name when they book.\n\nSee you soon!\n\n{{host_name}}{{unsub_link}}",
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
      name: "New Client Balayage: 15% Off",
      status: CampaignStatus.ACTIVE,
      dailyBudgetCents: 2500,
      audience: { radiusMi: 15, age: "22-55", interests: ["Hair care", "Beauty"] },
      leadForm: [
        { key: "name", label: "Name", required: true },
        { key: "phone", label: "Phone", required: true },
        { key: "service", label: "What are you looking for?", required: false },
      ],
      autoEnrollSequenceId: s2.id,
      spendCents: 31200,
      impressions: 52300,
      clicks: 1140,
      leadsCount: 3,
      startedAt: daysAgo(18),
      isDemo: true,
    },
  });
  await prisma.campaign.create({
    data: {
      orgId: org.id,
      propertyId: svc1.id,
      platform: AdPlatform.TIKTOK,
      name: "Transformation Tuesday Clips",
      status: CampaignStatus.ACTIVE,
      dailyBudgetCents: 2000,
      audience: { radiusMi: 20, age: "18-40" },
      leadForm: [
        { key: "name", label: "Name", required: true },
        { key: "email", label: "Email", required: true },
      ],
      autoEnrollSequenceId: s2.id,
      spendCents: 18400,
      impressions: 88100,
      clicks: 2310,
      leadsCount: 2,
      startedAt: daysAgo(12),
      isDemo: true,
    },
  });
  await prisma.campaign.create({
    data: {
      orgId: org.id,
      propertyId: svc3.id,
      platform: AdPlatform.PINTEREST,
      name: "Self-Care Sunday: Massage Intro",
      status: CampaignStatus.PAUSED,
      dailyBudgetCents: 1500,
      audience: { radiusMi: 20, age: "25-60" },
      leadForm: [
        { key: "name", label: "Name", required: true },
        { key: "email", label: "Email", required: true },
      ],
      spendCents: 9600,
      impressions: 30400,
      clicks: 520,
      leadsCount: 1,
      startedAt: daysAgo(25),
      isDemo: true,
    },
  });

  // ---------- integrations (idempotent) ----------
  for (const provider of ["meta", "tiktok", "twilio"] as const) {
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
    serviceId?: string;
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
        propertyId: input.serviceId ?? null,
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

  const jess = await lead({
    name: "Jess Alvarez",
    phone: "(704) 555-0119",
    source: LeadSource.DIRECT_SITE,
    serviceId: svc1.id,
    stage: Stage.NEW,
    createdAt: daysAgo(0, 4),
    timeframe: "This Saturday if possible",
    events: [
      {
        type: LeadEventType.INQUIRY_ABANDONED,
        title: "Started online booking: didn't finish",
        body: "Picked balayage, left at the payment step. Phone only.",
        occurredAt: daysAgo(0, 4),
      },
      {
        type: LeadEventType.SMS_SENT,
        channel: Channel.SMS,
        title: "SMS sent: instant hold-your-spot text",
        occurredAt: daysAgo(0, 4),
      },
    ],
    enroll: { sequenceId: s1.id, currentStep: 1 },
  });
  const s1step1 = s1.steps[1];
  if (jess.enrollment && s1step1) {
    await prisma.scheduledMessage.create({
      data: {
        orgId: org.id,
        enrollmentId: jess.enrollment.id,
        stepId: s1step1.id,
        channel: s1step1.channel,
        sendAt: new Date(Date.now() + 90 * 60_000),
        status: "PENDING",
        idempotencyKey: `${jess.enrollment.id}:${s1step1.id}`,
      },
    });
  }

  await lead({
    name: "Maya Brooks",
    email: "maya.brooks@example.com",
    phone: "(704) 555-0182",
    source: LeadSource.META,
    serviceId: svc1.id,
    campaignId: c1.id,
    stage: Stage.CONTACTED,
    createdAt: daysAgo(1, 2),
    timeframe: "Next week, evenings",
    detail: "Dark brown → caramel balayage",
    events: [
      { type: LeadEventType.CAPTURED, title: "Lead captured: Meta instant form", occurredAt: daysAgo(1, 2) },
      { type: LeadEventType.EMAIL_SENT, channel: Channel.EMAIL, title: "Email sent: new client welcome", occurredAt: daysAgo(1, 2) },
    ],
    enroll: { sequenceId: s2.id, currentStep: 1 },
  });

  await lead({
    name: "Chloe Winters",
    email: "chloe.w@example.com",
    phone: "(980) 555-0144",
    source: LeadSource.TIKTOK,
    serviceId: svc1.id,
    stage: Stage.QUOTED,
    createdAt: daysAgo(3),
    timeframe: "Flexible",
    detail: "Color correction, box dye fix",
    events: [
      { type: LeadEventType.CAPTURED, title: "Lead captured: TikTok form", occurredAt: daysAgo(3) },
      {
        type: LeadEventType.QUOTE_SENT,
        title: "Consult offered: color correction",
        body: "Needs in-person consult; est. $280–$380 over two sessions.",
        occurredAt: daysAgo(2),
      },
    ],
    enroll: { sequenceId: s3.id, currentStep: 1 },
  });

  await lead({
    name: "Dana Okafor",
    email: "dana.o@example.com",
    phone: "(704) 555-0167",
    source: LeadSource.META,
    serviceId: svc2.id,
    stage: Stage.ENGAGED,
    createdAt: daysAgo(2),
    timeframe: "Friday afternoon",
    detail: "Gel-X, chrome finish",
    needsAttention: true,
    events: [
      { type: LeadEventType.CAPTURED, title: "Lead captured: Meta instant form", occurredAt: daysAgo(2) },
      {
        type: LeadEventType.REPLIED,
        channel: Channel.SMS,
        title: "Replied to SMS",
        body: "\"Do you have anything Friday after 3? And how much is chrome?\"",
        occurredAt: daysAgo(0, 5),
      },
      { type: LeadEventType.SEQUENCE_PAUSED, title: "Sequence paused: human reply needed", occurredAt: daysAgo(0, 5) },
    ],
    enroll: { sequenceId: s2.id, currentStep: 2, status: "PAUSED" },
  });

  await lead({
    name: "Sofia Reyes",
    email: "sofia.reyes@example.com",
    phone: "(704) 555-0190",
    source: LeadSource.META,
    serviceId: svc1.id,
    campaignId: c1.id,
    stage: Stage.BOOKED,
    createdAt: daysAgo(8),
    timeframe: "Booked last Thursday",
    events: [
      { type: LeadEventType.CAPTURED, title: "Lead captured: Meta instant form", occurredAt: daysAgo(8) },
      { type: LeadEventType.BOOKED, title: "Booked: balayage + gloss, $240", occurredAt: daysAgo(5) },
      { type: LeadEventType.SMS_SENT, channel: Channel.SMS, title: "SMS sent: review request", occurredAt: daysAgo(4) },
    ],
    booking: { amountCents: 24000, bookedAt: daysAgo(5), campaignId: c1.id, sequenceId: s2.id },
  });

  await lead({
    name: "Hannah Lee",
    email: "hannah.lee@example.com",
    source: LeadSource.PINTEREST,
    serviceId: svc3.id,
    stage: Stage.CONTACTED,
    createdAt: daysAgo(4),
    timeframe: "Sunday mornings",
    detail: "Neck + shoulder focus",
    events: [
      { type: LeadEventType.CAPTURED, title: "Lead captured: Pinterest form", occurredAt: daysAgo(4) },
      { type: LeadEventType.EMAIL_SENT, channel: Channel.EMAIL, title: "Email sent: new client welcome", occurredAt: daysAgo(4) },
    ],
    enroll: { sequenceId: s2.id, currentStep: 1 },
  });

  await lead({
    name: "Priya Nair",
    phone: "(980) 555-0175",
    source: LeadSource.IMPORT,
    serviceId: svc1.id,
    stage: Stage.NEW,
    createdAt: daysAgo(1),
    timeframe: "Lapsed regular, last visit ~4 months ago",
    events: [
      {
        type: LeadEventType.IMPORTED,
        title: "Imported past client",
        body: "Regular every 6 weeks through last winter, then stopped booking.",
        occurredAt: daysAgo(1),
      },
    ],
    enroll: { sequenceId: s5.id, currentStep: 0 },
  });

  await lead({
    name: "Tara Jenkins",
    email: "tara.j@example.com",
    source: LeadSource.DIRECT_SITE,
    serviceId: svc2.id,
    stage: Stage.LOST,
    createdAt: daysAgo(11),
    events: [
      { type: LeadEventType.INQUIRY_STARTED, title: "Inquiry: bridal party nails (6 people)", occurredAt: daysAgo(11) },
      { type: LeadEventType.LOST_MARKED, title: "Marked lost: chose a salon closer to venue", occurredAt: daysAgo(6) },
    ],
  });

  void s4;
}
