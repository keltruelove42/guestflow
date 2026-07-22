/**
 * B2B SaaS vertical demo dataset: plan offerings, template
 * sequences, campaigns, and leads for a software vendor.
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

export async function seedSaasContent(orgId: string) {
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
  const [plan1, plan2, plan3] = await Promise.all([
    prisma.property.create({
      data: {
        orgId: org.id,
        name: "Starter Plan",
        location: "Self-serve",
        isDemo: true,
        photoUrl: "🚀",
        knowledgeBase:
          "$29/user/mo, billed monthly or annually. 14-day free trial, no card required. Core workflows, integrations, and reporting for teams up to 10.",
      },
    }),
    prisma.property.create({
      data: {
        orgId: org.id,
        name: "Pro Plan",
        location: "Sales-assisted",
        isDemo: true,
        photoUrl: "📈",
        knowledgeBase:
          "$79/user/mo. Includes SSO, priority support, advanced automations, and audit logs. Most popular plan: best fit for teams of 10 to 50.",
      },
    }),
    prisma.property.create({
      data: {
        orgId: org.id,
        name: "Enterprise",
        location: "Custom",
        isDemo: true,
        photoUrl: "🏢",
        knowledgeBase:
          "Custom pricing based on seats and usage. Security review, custom SLA, dedicated CSM, and SCIM provisioning. Demo required to scope the deployment.",
      },
    }),
  ]);

  // ---------- template sequences ----------
  const s1 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Trial Signup Welcome",
      trigger: SequenceTrigger.AD_LEAD_CAPTURED,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.EMAIL,
            subject: "Welcome to {{business_name}}: your first 3 steps",
            body: "Hi {{first_name}},\n\nWelcome aboard! Your trial is live. Here's how teams get value in the first hour:\n\n1. Connect your first data source (takes about 2 minutes)\n2. Invite one teammate so you can test collaboration\n3. Run the starter template from your dashboard\n\nYour workspace is here: {{quote_link}}\n\nStuck on anything? Just reply, a real human reads these.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 1,
            delayMinutes: 1440,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}} from {{business_name}}. How's the trial going so far? If anything is confusing I can jump on a quick call or send a walkthrough video. Happy to help. (Reply STOP to opt out)",
          },
          {
            order: 2,
            delayMinutes: 4320,
            channel: Channel.EMAIL,
            subject: "How a 14-person team cut reporting time by 60%",
            body: "Hi {{first_name}},\n\nQuick story: an ops team about your size moved onto {{business_name}} last quarter and cut their weekly reporting time by 60%. The case study is a 3-minute read: {{quote_link}}\n\nYou're a few days into your trial, so a heads up: upgrading to Pro unlocks SSO and priority support, and annual billing saves about 20%.\n\nWant help picking the right plan? Reply and I'll run the numbers with you.\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
  });

  const s2 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Gone-Quiet Trial Rescue",
      trigger: SequenceTrigger.INQUIRY_ABANDONED,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, it's {{host_name}} from {{business_name}}. Noticed you have not finished setting up your workspace. Totally normal, most people stall at the same step. Want a hand? (Reply STOP to opt out)",
          },
          {
            order: 1,
            delayMinutes: 120,
            channel: Channel.EMAIL,
            subject: "3 quick wins to get your workspace humming",
            body: "Hi {{first_name}},\n\nYour trial is saved exactly where you left it: {{quote_link}}\n\nHere are the 3 fastest wins other teams start with:\n\n1. Connect your existing tool via the one-click importer, your data shows up in minutes\n2. Turn on the daily digest so results land in your inbox automatically\n3. Use the prebuilt dashboard template, no configuration needed\n\nAny one of these takes under 5 minutes. If a question stopped you, reply and I'll give you a straight answer.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 2,
            delayMinutes: 2880,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}} here. Want me to set up your workspace with you on a 15-min call? I'll do the clicking, you just tell me how your team works. Grab a slot: {{quote_link}} (Reply STOP to opt out)",
          },
        ],
      },
    },
  });

  const s3 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Proposal Follow-Up",
      trigger: SequenceTrigger.QUOTE_UNACCEPTED_48H,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.EMAIL,
            subject: "Checking in on your proposal",
            body: "Hi {{first_name}},\n\nWanted to follow up on the proposal we sent over. Everything in it still stands: the seat count, the per-seat rate, and the onboarding plan.\n\nIf the numbers aren't quite right, tell me what would work. We can adjust seats, shift to annual billing, or stage the rollout by team.\n\nReview it again here: {{quote_link}}\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 1,
            delayMinutes: 2880,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}} from {{business_name}}. Any questions on the proposal? Happy to hop on a call with your team or loop in our security folks if that helps. (Reply STOP to opt out)",
          },
          {
            order: 2,
            delayMinutes: 10080,
            channel: Channel.EMAIL,
            subject: "Before this pricing expires",
            body: "Hi {{first_name}},\n\nNo pressure either way, but the pricing in your proposal is locked until the end of the month and I wanted you to have first crack at it before it resets.\n\nIf the deal wasn't quite right, reply and tell me what would make it work. Seat counts, terms, and start dates are all flexible.\n\nProposal is here: {{quote_link}}\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
  });

  const s4 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Demo No-Show Recovery",
      trigger: SequenceTrigger.MANUAL_ONLY,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, it's {{host_name}} from {{business_name}}. Sorry we missed you for the demo today! Calendars are brutal. Grab another time that works here: {{quote_link}} (Reply STOP to opt out)",
          },
          {
            order: 1,
            delayMinutes: 1440,
            channel: Channel.EMAIL,
            subject: "Demo recording + a fresh calendar link",
            body: "Hi {{first_name}},\n\nNo worries about yesterday. Two options so you don't lose momentum:\n\n1. Watch the 12-minute recorded demo on your own time: {{quote_link}}\n2. Rebook a live one and bring your team, same link has my calendar\n\nIf it's easier, reply with 2 or 3 times that work and I'll send an invite.\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
  });

  const s5 = await ensureSequence({
    data: {
      orgId: org.id,
      name: "Expansion Check-In",
      trigger: SequenceTrigger.CHECKOUT_PLUS_90D,
      active: true,
      isDemo: true,
      steps: {
        create: [
          {
            order: 0,
            delayMinutes: 0,
            channel: Channel.EMAIL,
            subject: "How did the rollout go?",
            body: "Hi {{first_name}},\n\nYou're about 90 days in, so a quick check-in: how did the rollout land with your team?\n\nLooking at your usage, you're regularly near your seat limit and your automation runs doubled last month. Teams at that level usually save money moving up a tier: more seats, higher limits, and SSO included.\n\nWant me to put together a usage-based comparison? Reply and I'll send it over, no sales pitch attached.\n\n{{host_name}}{{unsub_link}}",
          },
          {
            order: 1,
            delayMinutes: 7200,
            channel: Channel.SMS,
            body: "Hi {{first_name}}, {{host_name}} here. Still happy to run that plan comparison for you, takes me 10 minutes and there's no obligation. Want it? (Reply STOP to opt out)",
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
            body: "Hi {{first_name}}! Glad the team is up and running 🎉 If you have 2 minutes, a quick G2 review would mean a lot to us: {{quote_link}} (Reply STOP to opt out)",
          },
          {
            order: 1,
            delayMinutes: 10080,
            channel: Channel.EMAIL,
            subject: "Know a team that would love this? $200 credit each",
            body: "Hi {{first_name}},\n\nA thank-you from us: refer a team and you get a $200 account credit when they sign up, and they get $200 off their first invoice too. There's no cap, refer as many teams as you like.\n\nYour referral link is here: {{quote_link}}\n\nThanks for building with {{business_name}}!\n\n{{host_name}}{{unsub_link}}",
          },
        ],
      },
    },
  });

  // ---------- campaigns ----------
  const c1 = await prisma.campaign.create({
    data: {
      orgId: org.id,
      propertyId: plan1.id,
      platform: AdPlatform.META,
      name: "Free Trial: Ship Faster",
      status: CampaignStatus.ACTIVE,
      dailyBudgetCents: 3500,
      audience: { radiusMi: 0, age: "25-55", interests: ["SaaS founders", "Ops managers", "Productivity software"] },
      leadForm: [
        { key: "name", label: "Name", required: true },
        { key: "email", label: "Work email", required: true },
        { key: "teamsize", label: "How big is your team?", required: false },
      ],
      autoEnrollSequenceId: s1.id,
      spendCents: 48200,
      impressions: 88600,
      clicks: 1720,
      leadsCount: 3,
      startedAt: daysAgo(15),
      isDemo: true,
    },
  });
  await prisma.campaign.create({
    data: {
      orgId: org.id,
      propertyId: plan2.id,
      platform: AdPlatform.TIKTOK,
      name: "Founder Demo Clips",
      status: CampaignStatus.ACTIVE,
      dailyBudgetCents: 2500,
      audience: { age: "22-45", interests: ["Startups", "Founders", "B2B software"] },
      leadForm: [
        { key: "name", label: "Name", required: true },
        { key: "email", label: "Work email", required: true },
      ],
      autoEnrollSequenceId: s1.id,
      spendCents: 21400,
      impressions: 57300,
      clicks: 1090,
      leadsCount: 2,
      startedAt: daysAgo(10),
      isDemo: true,
    },
  });
  await prisma.campaign.create({
    data: {
      orgId: org.id,
      propertyId: plan1.id,
      platform: AdPlatform.PINTEREST,
      name: "Productivity Templates",
      status: CampaignStatus.PAUSED,
      dailyBudgetCents: 1500,
      audience: { age: "25-50", interests: ["Productivity", "Templates", "Small business"] },
      leadForm: [
        { key: "name", label: "Name", required: true },
        { key: "email", label: "Email", required: true },
      ],
      spendCents: 9800,
      impressions: 42700,
      clicks: 610,
      leadsCount: 1,
      startedAt: daysAgo(24),
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

  const priya = await lead({
    name: "Priya Raman",
    email: "priya@brightlaneagency.com",
    phone: "(415) 555-0184",
    source: LeadSource.DIRECT_SITE,
    productId: plan1.id,
    stage: Stage.NEW,
    createdAt: daysAgo(0, 3),
    timeframe: "Evaluating this quarter",
    detail: "Ops lead at 12-person agency",
    events: [
      {
        type: LeadEventType.INQUIRY_ABANDONED,
        title: "Started trial signup: didn't finish",
        body: "Created the account, connected email, dropped off at the data source step.",
        occurredAt: daysAgo(0, 3),
      },
      {
        type: LeadEventType.SMS_SENT,
        channel: Channel.SMS,
        title: "SMS sent: setup help offer",
        occurredAt: daysAgo(0, 3),
      },
    ],
    enroll: { sequenceId: s2.id, currentStep: 1 },
  });
  const s2step1 = s2.steps[1];
  if (priya.enrollment && s2step1) {
    await prisma.scheduledMessage.create({
      data: {
        orgId: org.id,
        enrollmentId: priya.enrollment.id,
        stepId: s2step1.id,
        channel: s2step1.channel,
        sendAt: new Date(Date.now() + 90 * 60_000),
        status: "PENDING",
        idempotencyKey: `${priya.enrollment.id}:${s2step1.id}`,
      },
    });
  }

  await lead({
    name: "Jordan Ellis",
    email: "jordan.ellis@northpeakco.com",
    source: LeadSource.IMPORT,
    productId: plan1.id,
    stage: Stage.NEW,
    createdAt: daysAgo(1),
    timeframe: "Attended webinar last fall",
    detail: "Founder, bootstrapped 6-person startup",
    events: [
      {
        type: LeadEventType.IMPORTED,
        title: "Imported from webinar attendee list",
        body: "Registered for the Q4 automation webinar, stayed for the full session, never started a trial.",
        occurredAt: daysAgo(1),
      },
    ],
  });

  await lead({
    name: "Maya Donnelly",
    email: "maya@ferrostudio.co",
    phone: "(628) 555-0147",
    source: LeadSource.META,
    productId: plan1.id,
    campaignId: c1.id,
    stage: Stage.CONTACTED,
    createdAt: daysAgo(1, 2),
    timeframe: "Wants to launch before end of month",
    detail: "Head of ops at 15-person design studio",
    events: [
      { type: LeadEventType.CAPTURED, title: "Lead captured: Meta instant form", occurredAt: daysAgo(1, 2) },
      { type: LeadEventType.EMAIL_SENT, channel: Channel.EMAIL, title: "Email sent: trial welcome", occurredAt: daysAgo(1, 2) },
    ],
    enroll: { sequenceId: s1.id, currentStep: 1 },
  });

  await lead({
    name: "Caleb Nguyen",
    email: "caleb@stackform.io",
    phone: "(206) 555-0173",
    source: LeadSource.TIKTOK,
    productId: plan1.id,
    stage: Stage.CONTACTED,
    createdAt: daysAgo(2, 4),
    timeframe: "Comparing tools this month",
    detail: "Solo founder, 4 contractors",
    events: [
      { type: LeadEventType.CAPTURED, title: "Lead captured: TikTok form", occurredAt: daysAgo(2, 4) },
      { type: LeadEventType.EMAIL_SENT, channel: Channel.EMAIL, title: "Email sent: trial welcome", occurredAt: daysAgo(2, 4) },
    ],
    enroll: { sequenceId: s1.id, currentStep: 1 },
  });

  await lead({
    name: "Dana Okafor",
    email: "dana.okafor@lumenhealthtech.com",
    phone: "(312) 555-0129",
    source: LeadSource.META,
    productId: plan2.id,
    stage: Stage.ENGAGED,
    createdAt: daysAgo(3),
    timeframe: "Decision in 2 weeks",
    detail: "Team of 20, needs SSO",
    needsAttention: true,
    events: [
      { type: LeadEventType.CAPTURED, title: "Lead captured: Meta instant form", occurredAt: daysAgo(3) },
      {
        type: LeadEventType.REPLIED,
        channel: Channel.SMS,
        title: "Replied to SMS",
        body: "\"If we start with 12 seats and add 8 more next quarter, does the per-seat price change? And is SSO extra?\"",
        occurredAt: daysAgo(0, 5),
      },
      { type: LeadEventType.SEQUENCE_PAUSED, title: "Sequence paused: human reply needed", occurredAt: daysAgo(0, 5) },
    ],
    enroll: { sequenceId: s1.id, currentStep: 2, status: "PAUSED" },
  });

  await lead({
    name: "Rob Feldman",
    email: "rfeldman@harborlogistics.com",
    phone: "(617) 555-0166",
    source: LeadSource.DIRECT_SITE,
    productId: plan2.id,
    stage: Stage.QUOTED,
    createdAt: daysAgo(6),
    timeframe: "Budget approved for this quarter",
    detail: "VP Ops at 45-person logistics firm",
    events: [
      { type: LeadEventType.CAPTURED, title: "Inquiry: pricing page demo request", occurredAt: daysAgo(6) },
      {
        type: LeadEventType.QUOTE_SENT,
        title: "Proposal sent: 20 seats Pro, $1,340/mo",
        body: "20 seats on Pro with annual billing discount, SSO included, onboarding session bundled in.",
        occurredAt: daysAgo(2),
      },
    ],
    enroll: { sequenceId: s3.id, currentStep: 1 },
  });

  await lead({
    name: "Ana Sofia Reyes",
    email: "ana.reyes@copperline.app",
    phone: "(737) 555-0158",
    source: LeadSource.META,
    productId: plan2.id,
    campaignId: c1.id,
    stage: Stage.BOOKED,
    createdAt: daysAgo(14),
    timeframe: "Signed last week",
    detail: "COO, 18-person fintech startup",
    events: [
      { type: LeadEventType.CAPTURED, title: "Lead captured: Meta instant form", occurredAt: daysAgo(14) },
      { type: LeadEventType.BOOKED, title: "Closed: annual Pro contract, $16,080/yr", occurredAt: daysAgo(5) },
      { type: LeadEventType.SMS_SENT, channel: Channel.SMS, title: "SMS sent: G2 review request", occurredAt: daysAgo(4) },
    ],
    booking: { amountCents: 1608000, bookedAt: daysAgo(5), campaignId: c1.id, sequenceId: s1.id },
  });

  await lead({
    name: "Greg Tanaka",
    email: "greg.tanaka@vantagebuild.com",
    source: LeadSource.DIRECT_SITE,
    productId: plan3.id,
    stage: Stage.LOST,
    createdAt: daysAgo(18),
    timeframe: "Was evaluating this quarter",
    detail: "IT director, 120-person construction firm",
    events: [
      { type: LeadEventType.INQUIRY_STARTED, title: "Inquiry: Enterprise demo request", occurredAt: daysAgo(18) },
      { type: LeadEventType.LOST_MARKED, title: "Marked lost: chose a competitor already on their approved vendor list", occurredAt: daysAgo(7) },
    ],
  });

  void s4;
  void s5;
}
