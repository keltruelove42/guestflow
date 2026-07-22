/**
 * Hotels & B&Bs vertical demo dataset: room types, template
 * sequences, campaigns, and leads for boutique inns and B&Bs.
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

export async function seedHotelsContent(orgId: string) {
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

  // ---------- rooms ----------
  const [room1, room2, room3] = await Promise.all([
    prisma.property.create({
      data: {
        orgId: org.id,
        name: "King Suite with Fireplace",
        location: "Main house",
        isDemo: true,
        photoUrl: "🛏️",
        knowledgeBase:
          "$249/night, sleeps 2. Wood-burning fireplace and soaking tub. 2-night minimum on weekends. Full breakfast served 8 to 10am. Most requested room for anniversaries.",
      },
    }),
    prisma.property.create({
      data: {
        orgId: org.id,
        name: "Garden Queen Room",
        location: "Garden wing",
        isDemo: true,
        photoUrl: "🌸",
        knowledgeBase:
          "$179/night, sleeps 2. Private patio access to the garden. Breakfast included. Quietest room on the property, popular with solo travelers and couples.",
      },
    }),
    prisma.property.create({
      data: {
        orgId: org.id,
        name: "The Carriage House",
        location: "Private cottage",
        isDemo: true,
        photoUrl: "🏘️",
        knowledgeBase:
          "$329/night, sleeps 4. Detached cottage with kitchenette and private entrance. Pet friendly with a $35 cleaning fee. Great for families and longer stays.",
      },
    }),
  ]);

  // ---------- template sequences ----------
  const s1 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Abandoned Booking Rescue",
      trigger: SequenceTrigger.INQUIRY_ABANDONED,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, it's {{host_name}} at {{business_name}}. Saw you were looking at {{property}} for {{dates}}. Your dates are still open, want me to hold them for you? (Reply STOP to opt out)",
          },
          {
            order: 1,
            delayMinutes: 120,
            channel: Channel.EMAIL,
            subject: "Still thinking it over? Here's the full picture",
            body: "Hi {{first_name}},\n\nYou were one click away from {{property}} for {{dates}}, so here's everything worth knowing before you decide:\n\n• Full breakfast is included with every stay, served 8 to 10am\n• Free cancellation up to 7 days before check-in\n• Book direct and you'll always get our best rate\n\nPick up right where you left off: {{quote_link}}\n\nAny questions at all, just reply. I read every one.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 2,
            delayMinutes: 1440,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}} again. Just a heads up, weekends fill fast this {{season}} and I'd hate for you to miss your dates. Want me to finish the booking for you? (Reply STOP to opt out)",
          },
        ],
      },
    },
  });

  const s2 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Direct Booking Welcome",
      trigger: SequenceTrigger.AD_LEAD_CAPTURED,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.EMAIL,
            subject: "Why our guests always book direct",
            body: "Hi {{first_name}},\n\nThanks for your interest in {{business_name}}! Before you compare us on the big booking sites, here's what booking direct gets you:\n\n• Our best rate, guaranteed, no middleman markup\n• A free breakfast upgrade: chef's special instead of the standard menu\n• Flexible cancellation, because plans change\n\nBrowse rooms and check your dates here: {{quote_link}}\n\nHope to welcome you soon,\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 1,
            delayMinutes: 1440,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, it's {{host_name}} from {{business_name}}. Happy to help you pick the right room, every one of our 12 is a little different. What matters most to you: quiet, space, or the fireplace? (Reply STOP to opt out)",
          },
          {
            order: 2,
            delayMinutes: 4320,
            channel: Channel.EMAIL,
            subject: "Your perfect weekend here, hour by hour",
            body: "Hi {{first_name}},\n\nStill dreaming about a getaway? Here's the weekend our guests rave about:\n\nSaturday: breakfast on the porch, morning at the farmers market two blocks away, afternoon wine tasting at the vineyard up the road, dinner at the bistro we'll happily book for you.\n\nSunday: sleep in, late breakfast, a slow walk on the river trail before checkout.\n\nAll of it starts with picking your dates: {{quote_link}}\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
  });

  const s3 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Quote Follow-Up",
      trigger: SequenceTrigger.QUOTE_UNACCEPTED_48H,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.EMAIL,
            subject: "Your quote for {{dates}} is still good",
            body: "Hi {{first_name}},\n\nJust checking in: the quote I sent for {{property}} over {{dates}} is still good, and your dates are still available.\n\nReview it here: {{quote_link}}\n\nIf anything gave you pause, the rate, the room, the dates, just reply and tell me. There's usually something I can do.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 1,
            delayMinutes: 2880,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}} here. Quick heads up: there's one {{property}} left for your dates. Want me to lock it in before someone else does? (Reply STOP to opt out)",
          },
          {
            order: 2,
            delayMinutes: 8640,
            channel: Channel.EMAIL,
            subject: "Before I release your dates",
            body: "Hi {{first_name}},\n\nNo pressure either way, but I'm about to open {{dates}} back up to other guests and wanted to give you first choice.\n\nIf the timing shifted, tell me what works and I'll send a fresh quote. If the rate was the sticking point, reply and let's talk, midweek stays are often more flexible.\n\nYour original quote: {{quote_link}}\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
  });

  const s4 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Special Occasion Concierge",
      trigger: SequenceTrigger.MANUAL_ONLY,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, it's {{host_name}} at {{business_name}}. Is your upcoming stay a special occasion? We can arrange flowers in the room, a bottle of local wine, or late checkout. Just say the word. (Reply STOP to opt out)",
          },
          {
            order: 1,
            delayMinutes: 1440,
            channel: Channel.EMAIL,
            subject: "Little touches that make a big stay",
            body: "Hi {{first_name}},\n\nHere's our add-on menu, all arranged before you arrive:\n\n• Fresh flowers in the room: $45\n• Local wine and cheese board waiting at check-in: $55\n• Couples massage in the garden studio: $180\n• Late checkout until 1pm: $40, free for returning guests\n• Picnic basket for a day out: $65\n\nReply with what sounds good and I'll have it ready.\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
  });

  const s5 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Return Stay Invite",
      trigger: SequenceTrigger.CHECKOUT_PLUS_90D,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.EMAIL,
            subject: "Your favorite room misses you",
            body: "Hi {{first_name}},\n\nIt's been a few months since your stay with us, and {{property}} has been asking about you.\n\nAs a returning guest you get 10% off your next stay with code WELCOMEBACK10, plus late checkout on the house.\n\nCheck dates here: {{quote_link}}\n\nThe {{season}} calendar is filling in, so if you have a weekend in mind, sooner is better.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 1,
            delayMinutes: 7200,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}} here. Your returning guest code WELCOMEBACK10 is good for 10% off any stay this {{season}}. Want me to check some dates for you? (Reply STOP to opt out)",
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
            body: "Hi {{first_name}}! It was such a pleasure hosting you at {{business_name}}. If you have 60 seconds, a review on TripAdvisor or Google means the world to a small inn: {{quote_link}} (Reply STOP to opt out)",
          },
          {
            order: 1,
            delayMinutes: 10080,
            channel: Channel.EMAIL,
            subject: "Gift a stay, get a night on us",
            body: "Hi {{first_name}},\n\nA thank-you from all of us: gift a stay to a friend and when they check out, you get a free midweek night on your next visit. They just mention your name when booking.\n\nIt's our favorite way to meet new guests, through the good ones we already know.\n\nHope to see you again soon,\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
  });

  // ---------- campaigns ----------
  const c1 = await prisma.campaign.create({
    data: {
      orgId: org.id,
      propertyId: room1.id,
      platform: AdPlatform.META,
      name: "Fall Getaway: 2 Nights + Breakfast",
      status: CampaignStatus.ACTIVE,
      dailyBudgetCents: 3000,
      audience: { radiusMi: 120, age: "28-65", interests: ["Travel", "Bed and breakfasts", "Wine"] },
      leadForm: [
        { key: "name", label: "Name", required: true },
        { key: "email", label: "Email", required: true },
        { key: "dates", label: "When are you thinking of visiting?", required: false },
      ],
      autoEnrollSequenceId: s2.id,
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
      propertyId: room2.id,
      platform: AdPlatform.PINTEREST,
      name: "Cozy Weekend Inspo",
      status: CampaignStatus.ACTIVE,
      dailyBudgetCents: 2000,
      audience: { radiusMi: 150, age: "25-55", interests: ["Cozy aesthetics", "Weekend trips"] },
      leadForm: [
        { key: "name", label: "Name", required: true },
        { key: "email", label: "Email", required: true },
      ],
      autoEnrollSequenceId: s2.id,
      spendCents: 18900,
      impressions: 52300,
      clicks: 990,
      leadsCount: 2,
      startedAt: daysAgo(10),
      isDemo: true,
    },
  });
  await prisma.campaign.create({
    data: {
      orgId: org.id,
      propertyId: room3.id,
      platform: AdPlatform.TIKTOK,
      name: "Inn Tour Clips",
      status: CampaignStatus.PAUSED,
      dailyBudgetCents: 1800,
      audience: { radiusMi: 200, age: "22-45" },
      leadForm: [
        { key: "name", label: "Name", required: true },
        { key: "email", label: "Email", required: true },
      ],
      spendCents: 9600,
      impressions: 44100,
      clicks: 720,
      leadsCount: 1,
      startedAt: daysAgo(21),
      isDemo: true,
    },
  });

  // ---------- integrations (idempotent) ----------
  for (const provider of ["meta", "klaviyo"] as const) {
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
  for (const provider of ["twilio", "stripe", "pinterest"] as const) {
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
    roomId?: string;
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
        propertyId: input.roomId ?? null,
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
          propertyId: input.roomId ?? null,
          amountCents: input.booking.amountCents,
          bookedAt: input.booking.bookedAt,
          attributedCampaignId: input.booking.campaignId ?? null,
          attributedSequenceId: input.booking.sequenceId ?? null,
        },
      });
    }
    return { lead: l, enrollment: null };
  }

  const jenna = await lead({
    name: "Jenna Marsh",
    phone: "(802) 555-0184",
    source: LeadSource.DIRECT_SITE,
    roomId: room1.id,
    stage: Stage.NEW,
    createdAt: daysAgo(0, 4),
    timeframe: "Oct 17-19 anniversary trip",
    detail: "2 adults, king bed, quiet room",
    events: [
      {
        type: LeadEventType.INQUIRY_ABANDONED,
        title: "Started booking: didn't finish",
        body: "Selected King Suite for Oct 17-19, got to the payment step, dropped off. Phone only.",
        occurredAt: daysAgo(0, 4),
      },
      {
        type: LeadEventType.SMS_SENT,
        channel: Channel.SMS,
        title: "SMS sent: hold-your-dates text",
        occurredAt: daysAgo(0, 4),
      },
    ],
    enroll: { sequenceId: s1.id, currentStep: 1 },
  });
  const s1step1 = s1.steps[1];
  if (jenna.enrollment && s1step1) {
    await prisma.scheduledMessage.create({
      data: {
        orgId: org.id,
        enrollmentId: jenna.enrollment.id,
        stepId: s1step1.id,
        channel: s1step1.channel,
        sendAt: new Date(Date.now() + 90 * 60_000),
        status: "PENDING",
        idempotencyKey: `${jenna.enrollment.id}:${s1step1.id}`,
      },
    });
  }

  await lead({
    name: "Harold Finch",
    email: "harold.finch@example.com",
    source: LeadSource.IMPORT,
    roomId: room2.id,
    stage: Stage.NEW,
    createdAt: daysAgo(1),
    timeframe: "Stayed twice, last visit 4 months ago",
    detail: "Guestbook list, prefers Garden wing",
    events: [
      {
        type: LeadEventType.IMPORTED,
        title: "Imported from guestbook list",
        body: "Two past stays in the Garden Queen Room. Left a 5-star review last spring. Strong return-stay candidate.",
        occurredAt: daysAgo(1),
      },
    ],
    enroll: { sequenceId: s5.id, currentStep: 0 },
  });

  await lead({
    name: "Priya Raman",
    email: "priya.raman@example.com",
    phone: "(802) 555-0139",
    source: LeadSource.META,
    roomId: room1.id,
    campaignId: c1.id,
    stage: Stage.CONTACTED,
    createdAt: daysAgo(1, 2),
    timeframe: "First weekend of November",
    detail: "2 adults, celebrating a promotion",
    events: [
      { type: LeadEventType.CAPTURED, title: "Lead captured: Meta instant form", occurredAt: daysAgo(1, 2) },
      { type: LeadEventType.EMAIL_SENT, channel: Channel.EMAIL, title: "Email sent: book direct welcome", occurredAt: daysAgo(1, 2) },
    ],
    enroll: { sequenceId: s2.id, currentStep: 1 },
  });

  await lead({
    name: "Colleen Byrne",
    email: "colleen.byrne@example.com",
    source: LeadSource.PINTEREST,
    roomId: room2.id,
    campaignId: c2.id,
    stage: Stage.CONTACTED,
    createdAt: daysAgo(2, 3),
    timeframe: "Sometime this fall, flexible",
    detail: "Solo traveler, wants patio and quiet",
    events: [
      { type: LeadEventType.CAPTURED, title: "Lead captured: Pinterest lead form", occurredAt: daysAgo(2, 3) },
      { type: LeadEventType.EMAIL_SENT, channel: Channel.EMAIL, title: "Email sent: book direct welcome", occurredAt: daysAgo(2, 3) },
    ],
    enroll: { sequenceId: s2.id, currentStep: 1 },
  });

  await lead({
    name: "Dana Whitlock",
    email: "dana.whitlock@example.com",
    phone: "(603) 555-0217",
    source: LeadSource.META,
    roomId: room3.id,
    stage: Stage.ENGAGED,
    createdAt: daysAgo(2),
    timeframe: "Columbus Day weekend",
    detail: "2 adults + dog, 3 nights",
    needsAttention: true,
    events: [
      { type: LeadEventType.CAPTURED, title: "Lead captured: Meta instant form", occurredAt: daysAgo(2) },
      {
        type: LeadEventType.REPLIED,
        channel: Channel.SMS,
        title: "Replied to SMS",
        body: "\"is the Carriage House pet friendly? We have a corgi\"",
        occurredAt: daysAgo(0, 5),
      },
      { type: LeadEventType.SEQUENCE_PAUSED, title: "Sequence paused: human reply needed", occurredAt: daysAgo(0, 5) },
    ],
    enroll: { sequenceId: s2.id, currentStep: 2, status: "PAUSED" },
  });

  await lead({
    name: "Robert Ellison",
    email: "robert.ellison@example.com",
    phone: "(802) 555-0166",
    source: LeadSource.DIRECT_SITE,
    roomId: room1.id,
    stage: Stage.QUOTED,
    createdAt: daysAgo(5),
    timeframe: "Oct 24-26, 30th anniversary",
    detail: "2 adults, wants fireplace and late checkout",
    events: [
      { type: LeadEventType.CAPTURED, title: "Inquiry: website contact form", occurredAt: daysAgo(5) },
      {
        type: LeadEventType.QUOTE_SENT,
        title: "Quote sent: King Suite, 2 nights, $538",
        body: "$249/night x 2 plus tax, includes chef's breakfast both mornings. Anniversary flowers offered as add-on.",
        occurredAt: daysAgo(3),
      },
    ],
    enroll: { sequenceId: s3.id, currentStep: 1 },
  });

  await lead({
    name: "Meredith Chao",
    email: "meredith.chao@example.com",
    phone: "(802) 555-0192",
    source: LeadSource.META,
    roomId: room1.id,
    campaignId: c1.id,
    stage: Stage.BOOKED,
    createdAt: daysAgo(9),
    timeframe: "Stayed last weekend",
    events: [
      { type: LeadEventType.CAPTURED, title: "Lead captured: Meta instant form", occurredAt: daysAgo(9) },
      { type: LeadEventType.BOOKED, title: "Booked: King Suite, 2 nights, $538", occurredAt: daysAgo(6) },
      { type: LeadEventType.SMS_SENT, channel: Channel.SMS, title: "SMS sent: review request", occurredAt: daysAgo(2) },
    ],
    booking: { amountCents: 53800, bookedAt: daysAgo(6), campaignId: c1.id, sequenceId: s2.id },
  });

  await lead({
    name: "Grant Osborn",
    email: "grant.osborn@example.com",
    source: LeadSource.DIRECT_SITE,
    roomId: room2.id,
    stage: Stage.LOST,
    createdAt: daysAgo(13),
    events: [
      { type: LeadEventType.INQUIRY_STARTED, title: "Inquiry: Garden Queen availability request", occurredAt: daysAgo(13) },
      { type: LeadEventType.LOST_MARKED, title: "Marked lost: found availability elsewhere", occurredAt: daysAgo(8) },
    ],
  });

  void s4;
}
