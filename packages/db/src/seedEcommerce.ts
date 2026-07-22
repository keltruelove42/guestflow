/**
 * D2C ecommerce vertical demo dataset: offerings, template
 * sequences, campaigns, and leads for direct-to-consumer online stores.
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

export async function seedEcommerceContent(orgId: string) {
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

  // ---------- offerings ----------
  const [inv1, inv2, inv3] = await Promise.all([
    prisma.property.create({
      data: {
        orgId: org.id,
        name: "Best-Seller Bundle",
        location: "Hero product",
        isDemo: true,
        photoUrl: "✨",
        knowledgeBase:
          "The $68 bundle: cleanser, serum, and moisturizer. Ships free on orders over $50. 30-day money-back guarantee, no questions asked. Fragrance-free and dermatologist tested.",
      },
    }),
    prisma.property.create({
      data: {
        orgId: org.id,
        name: "Subscription Box",
        location: "Subscriptions",
        isDemo: true,
        photoUrl: "📦",
        knowledgeBase:
          "$39/mo subscription box. Skip a month or cancel anytime, no fees. Saves 15% vs one-time purchase and includes a rotating bonus sample each month.",
      },
    }),
    prisma.property.create({
      data: {
        orgId: org.id,
        name: "New Arrivals Drop",
        location: "Seasonal",
        isDemo: true,
        photoUrl: "🌿",
        knowledgeBase:
          "Limited seasonal runs, small batches that sell out fast. Waitlist available for sold-out items, waitlist members get 24-hour early access to restocks.",
      },
    }),
  ]);

  // ---------- template sequences ----------
  const s1 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Abandoned Cart Rescue",
      trigger: SequenceTrigger.INQUIRY_ABANDONED,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, it's {{host_name}} from {{business_name}}. Your cart is saved and waiting for you! Finish checkout whenever you're ready: {{quote_link}} (Reply STOP to opt out)",
          },
          {
            order: 1,
            delayMinutes: 120,
            channel: Channel.EMAIL,
            subject: "Still thinking it over? Your cart is safe with us",
            body: "Hi {{first_name}},\n\nEverything you picked out is still in your cart, and good news: your order already qualifies for free shipping (we cover it on everything over $50).\n\nA quick reminder of why people love these:\n\n• 30-day money-back guarantee, no questions asked\n• Clean formulas, fragrance-free\n• Ships within 24 hours\n\nPick up right where you left off: {{quote_link}}\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 2,
            delayMinutes: 1440,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}} here. Your cart is about to expire, so here's 10% off to make it easy: use code CODA10 at checkout. {{quote_link}} (Reply STOP to opt out)",
          },
        ],
      },
    },
  });

  const s2 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Welcome Series",
      trigger: SequenceTrigger.AD_LEAD_CAPTURED,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.EMAIL,
            subject: "Welcome! Here's 15% off your first order",
            body: "Hi {{first_name}},\n\nWelcome to {{business_name}}! We started this brand in a home kitchen with one belief: skincare should be simple, honest, and actually work.\n\nAs a thank you for joining, here's 15% off your first order with code WELCOME15.\n\nStart with our Best-Seller Bundle, it's the routine 40,000+ customers swear by: {{quote_link}}\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 1,
            delayMinutes: 1440,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, it's {{host_name}} from {{business_name}}. Your 15% welcome code is waiting! Use WELCOME15 at checkout: {{quote_link}} (Reply STOP to opt out)",
          },
          {
            order: 2,
            delayMinutes: 4320,
            channel: Channel.EMAIL,
            subject: "The three products everyone starts with",
            body: "Hi {{first_name}},\n\nNot sure where to begin? Here's what our customers reach for first:\n\n• Best-Seller Bundle: 4.9 stars from 12,000+ reviews\n• Subscription Box: save 15% and never run out\n• New Arrivals Drop: small batches, they sell out fast\n\n\"I've tried everything for my skin. This is the first routine I've actually finished.\" - Jamie R., verified buyer\n\nYour WELCOME15 code still works: {{quote_link}}\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
  });

  const s3 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Offer Follow-Up",
      trigger: SequenceTrigger.QUOTE_UNACCEPTED_48H,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.EMAIL,
            subject: "Your discount code has not been used yet",
            body: "Hi {{first_name}},\n\nJust a heads up: the discount code we sent you is still sitting unused, and it's good on anything in the store.\n\nIf you had a question before ordering, just reply to this email, a real person reads every message and we answer fast.\n\nApply your code here: {{quote_link}}\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 1,
            delayMinutes: 2880,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}} here. Last chance: your discount code expires soon and we can't extend it after that. Grab your order here: {{quote_link}} (Reply STOP to opt out)",
          },
          {
            order: 2,
            delayMinutes: 7200,
            channel: Channel.EMAIL,
            subject: "Before your code expires tonight",
            body: "Hi {{first_name}},\n\nThis is the last note from us about your code, it expires at midnight tonight.\n\nIf now isn't the right time, no worries at all. If something held you back, reply and tell us, we genuinely want to know.\n\nOne last time, here's your link: {{quote_link}}\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
  });

  const s4 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Back-In-Stock Alert",
      trigger: SequenceTrigger.MANUAL_ONLY,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, it's {{host_name}} from {{business_name}}. It is back! The item you waitlisted just restocked, and these go fast: {{quote_link}} (Reply STOP to opt out)",
          },
          {
            order: 1,
            delayMinutes: 1440,
            channel: Channel.EMAIL,
            subject: "Restocked, but not for long",
            body: "Hi {{first_name}},\n\nThe product you asked about is back in stock as of yesterday. Last {{season}} it sold out in under a week, so if you want it, now is the moment.\n\nWaitlist members like you get first access, so your link is already live: {{quote_link}}\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
  });

  const s5 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Replenishment Reminder",
      trigger: SequenceTrigger.CHECKOUT_PLUS_90D,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.EMAIL,
            subject: "Time to restock? Your last order is running low",
            body: "Hi {{first_name}},\n\nBased on your last order, you're probably getting close to the bottom of the jar. Reorder in one click: {{quote_link}}\n\nEven better: switch to the Subscription Box and save 15% on every delivery. Skip a month or cancel anytime, no fees, no phone calls.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 1,
            delayMinutes: 4320,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}} here. Don't get caught with an empty bottle! Reorder in one tap, or subscribe and save 15%: {{quote_link}} (Reply STOP to opt out)",
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
            delayMinutes: 0,
            channel: Channel.SMS,
            body: "Hi {{first_name}}! It's {{host_name}} from {{business_name}}. How's the new routine treating you? If you have 30 seconds, a review would mean the world to our small team: {{quote_link}} (Reply STOP to opt out)",
          },
          {
            order: 1,
            delayMinutes: 10080,
            channel: Channel.EMAIL,
            subject: "Give $15, get $15",
            body: "Hi {{first_name}},\n\nA thank you from us: share your referral link with a friend and they get $15 off their first order. When they buy, you get $15 in store credit, no limits.\n\nGrab your link here: {{quote_link}}\n\nThanks for being part of this!\n\n{{host_name}}{{unsub_link}}",
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
      name: "Bundle Launch: 15% Off First Order",
      status: CampaignStatus.ACTIVE,
      dailyBudgetCents: 4000,
      audience: { age: "22-45", interests: ["Skincare", "Clean beauty", "Wellness"] },
      leadForm: [
        { key: "name", label: "Name", required: true },
        { key: "email", label: "Email", required: true },
        { key: "skintype", label: "What's your skin type?", required: false },
      ],
      autoEnrollSequenceId: s2.id,
      spendCents: 48600,
      impressions: 132000,
      clicks: 2940,
      leadsCount: 3,
      startedAt: daysAgo(14),
      isDemo: true,
    },
  });
  await prisma.campaign.create({
    data: {
      orgId: org.id,
      propertyId: inv3.id,
      platform: AdPlatform.TIKTOK,
      name: "UGC Creator Clips",
      status: CampaignStatus.ACTIVE,
      dailyBudgetCents: 3000,
      audience: { age: "18-34", interests: ["Beauty", "Self care"] },
      leadForm: [
        { key: "name", label: "Name", required: true },
        { key: "email", label: "Email", required: true },
      ],
      autoEnrollSequenceId: s2.id,
      spendCents: 31200,
      impressions: 214000,
      clicks: 4100,
      leadsCount: 2,
      startedAt: daysAgo(10),
      isDemo: true,
    },
  });
  await prisma.campaign.create({
    data: {
      orgId: org.id,
      propertyId: inv2.id,
      platform: AdPlatform.PINTEREST,
      name: "Routine Inspo Boards",
      status: CampaignStatus.PAUSED,
      dailyBudgetCents: 2000,
      audience: { age: "25-54", interests: ["Skincare routine", "Minimalism"] },
      leadForm: [
        { key: "name", label: "Name", required: true },
        { key: "email", label: "Email", required: true },
      ],
      spendCents: 11800,
      impressions: 68400,
      clicks: 990,
      leadsCount: 1,
      startedAt: daysAgo(21),
      isDemo: true,
    },
  });

  // ---------- integrations (idempotent) ----------
  for (const provider of ["meta", "tiktok", "klaviyo"] as const) {
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
  for (const provider of ["stripe", "twilio", "pinterest"] as const) {
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
    productId?: string;
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
        propertyId: input.productId ?? null,
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
          propertyId: input.productId ?? null,
          amountCents: input.booking.amountCents,
          bookedAt: input.booking.bookedAt,
          attributedCampaignId: input.booking.campaignId ?? null,
          attributedSequenceId: input.booking.sequenceId ?? null,
        },
      });
    }
    return { lead: l, enrollment: null };
  }

  const maya = await lead({
    name: "Maya Sullivan",
    phone: "(415) 555-0182",
    source: LeadSource.DIRECT_SITE,
    productId: inv1.id,
    stage: Stage.NEW,
    createdAt: daysAgo(0, 2),
    timeframe: "Cart from today",
    detail: "Cart: bundle + serum, $84",
    events: [
      {
        type: LeadEventType.INQUIRY_ABANDONED,
        title: "Abandoned cart at checkout",
        body: "Added Best-Seller Bundle and extra serum, dropped off at the payment step. Phone only.",
        occurredAt: daysAgo(0, 2),
      },
      {
        type: LeadEventType.SMS_SENT,
        channel: Channel.SMS,
        title: "SMS sent: your cart is saved",
        occurredAt: daysAgo(0, 2),
      },
    ],
    enroll: { sequenceId: s1.id, currentStep: 1 },
  });
  const s1step1 = s1.steps[1];
  if (maya.enrollment && s1step1) {
    await prisma.scheduledMessage.create({
      data: {
        orgId: org.id,
        enrollmentId: maya.enrollment.id,
        stepId: s1step1.id,
        channel: s1step1.channel,
        sendAt: new Date(Date.now() + 90 * 60_000),
        status: "PENDING",
        idempotencyKey: `${maya.enrollment.id}:${s1step1.id}`,
      },
    });
  }

  await lead({
    name: "Devon Marsh",
    email: "devon.marsh@example.com",
    source: LeadSource.IMPORT,
    productId: inv1.id,
    stage: Stage.NEW,
    createdAt: daysAgo(1),
    timeframe: "Last ordered 3 months ago",
    detail: "From spring pop-up shop list",
    events: [
      {
        type: LeadEventType.IMPORTED,
        title: "Imported from pop-up shop list",
        body: "Bought the bundle at the spring pop-up. Likely due for a restock, good subscription candidate.",
        occurredAt: daysAgo(1),
      },
    ],
    enroll: { sequenceId: s5.id, currentStep: 0 },
  });

  await lead({
    name: "Jasmine Okafor",
    email: "jasmine.o@example.com",
    phone: "(312) 555-0147",
    source: LeadSource.META,
    productId: inv1.id,
    campaignId: c1.id,
    stage: Stage.CONTACTED,
    createdAt: daysAgo(1, 4),
    timeframe: "New this week",
    detail: "Skin type: combination, from bundle ad",
    events: [
      { type: LeadEventType.CAPTURED, title: "Lead captured: Meta instant form", occurredAt: daysAgo(1, 4) },
      { type: LeadEventType.EMAIL_SENT, channel: Channel.EMAIL, title: "Email sent: welcome with WELCOME15", occurredAt: daysAgo(1, 4) },
    ],
    enroll: { sequenceId: s2.id, currentStep: 1 },
  });

  await lead({
    name: "Hannah Reyes",
    email: "hannah.reyes@example.com",
    source: LeadSource.PINTEREST,
    productId: inv2.id,
    stage: Stage.CONTACTED,
    createdAt: daysAgo(3),
    timeframe: "Browsing routines",
    detail: "Saved the routine board, asked about subscriptions",
    events: [
      { type: LeadEventType.CAPTURED, title: "Lead captured: Pinterest form", occurredAt: daysAgo(3) },
      { type: LeadEventType.EMAIL_SENT, channel: Channel.EMAIL, title: "Email sent: welcome with WELCOME15", occurredAt: daysAgo(3) },
    ],
    enroll: { sequenceId: s2.id, currentStep: 1 },
  });

  await lead({
    name: "Priya Raman",
    email: "priya.raman@example.com",
    phone: "(617) 555-0129",
    source: LeadSource.TIKTOK,
    productId: inv1.id,
    stage: Stage.ENGAGED,
    createdAt: daysAgo(2),
    timeframe: "Deciding this week",
    detail: "Sensitive skin, comparing with current routine",
    needsAttention: true,
    events: [
      { type: LeadEventType.CAPTURED, title: "Lead captured: TikTok form", occurredAt: daysAgo(2) },
      {
        type: LeadEventType.REPLIED,
        channel: Channel.SMS,
        title: "Replied to SMS",
        body: "\"does the bundle work for sensitive skin?\"",
        occurredAt: daysAgo(0, 5),
      },
      { type: LeadEventType.SEQUENCE_PAUSED, title: "Sequence paused: human reply needed", occurredAt: daysAgo(0, 5) },
    ],
    enroll: { sequenceId: s2.id, currentStep: 2, status: "PAUSED" },
  });

  await lead({
    name: "Nathan Cole",
    email: "nathan.cole@example.com",
    phone: "(206) 555-0193",
    source: LeadSource.DIRECT_SITE,
    productId: inv1.id,
    stage: Stage.QUOTED,
    createdAt: daysAgo(4),
    timeframe: "Cart from 4 days ago",
    detail: "Cart: bundle + serum, $84",
    events: [
      { type: LeadEventType.CAPTURED, title: "Signed up on site for first-order discount", occurredAt: daysAgo(4) },
      {
        type: LeadEventType.QUOTE_SENT,
        title: "Code sent: WELCOME15, cart $84",
        body: "15% first-order code sent by email. Cart holds the Best-Seller Bundle plus an extra serum.",
        occurredAt: daysAgo(2),
      },
    ],
    enroll: { sequenceId: s3.id, currentStep: 1 },
  });

  await lead({
    name: "Olivia Tran",
    email: "olivia.tran@example.com",
    phone: "(503) 555-0168",
    source: LeadSource.META,
    productId: inv1.id,
    campaignId: c1.id,
    stage: Stage.BOOKED,
    createdAt: daysAgo(8),
    timeframe: "Ordered this week",
    detail: "First order: bundle + serum, $84",
    events: [
      { type: LeadEventType.CAPTURED, title: "Lead captured: Meta instant form", occurredAt: daysAgo(8) },
      { type: LeadEventType.BOOKED, title: "Order placed: bundle + serum, $84", occurredAt: daysAgo(2) },
      { type: LeadEventType.SMS_SENT, channel: Channel.SMS, title: "SMS sent: review request", occurredAt: daysAgo(1) },
    ],
    booking: { amountCents: 8400, bookedAt: daysAgo(2), campaignId: c1.id, sequenceId: s2.id },
  });

  await lead({
    name: "Carla Mendes",
    email: "carla.mendes@example.com",
    source: LeadSource.DIRECT_SITE,
    productId: inv2.id,
    stage: Stage.LOST,
    createdAt: daysAgo(15),
    events: [
      { type: LeadEventType.INQUIRY_STARTED, title: "Inquiry: subscription box questions", occurredAt: daysAgo(15) },
      { type: LeadEventType.LOST_MARKED, title: "Marked lost: unsubscribed, wanted one-time purchase only", occurredAt: daysAgo(9) },
    ],
  });

  void s4;
}
