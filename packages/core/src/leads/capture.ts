import { prisma, type LeadSource } from "@guestflow/db";
import {
  autoEnroll,
  pauseActiveEnrollments,
  stopActiveEnrollments,
} from "../sequences/autoEnroll";
import { normalizeEmail } from "./normalize";

export type CaptureInput = {
  orgId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  travelDates?: string | null;
  partySize?: string | null;
  source: LeadSource;
  propertyId?: string | null;
  campaignId?: string | null;
  externalRef?: string | null;
  emailConsent?: boolean;
  smsConsent?: boolean;
  consentText?: string;
  now?: Date;
  isDemo?: boolean;
};

export type CaptureResult = {
  leadId: string;
  created: boolean;
  merged: boolean;
};

/**
 * Create or merge a lead from an ad/PMS capture, then auto-enroll when applicable.
 */
export async function createFromCapture(input: CaptureInput): Promise<CaptureResult> {
  const now = input.now ?? new Date();
  const email = normalizeEmail(input.email);
  const phone = input.phone?.trim() || null;

  // Idempotent by externalRef
  if (input.externalRef) {
    const byRef = await prisma.lead.findUnique({
      where: {
        orgId_externalRef: { orgId: input.orgId, externalRef: input.externalRef },
      },
    });
    if (byRef) {
      return { leadId: byRef.id, created: false, merged: false };
    }
  }

  // Dedupe by email or phone
  let existing = null as Awaited<ReturnType<typeof prisma.lead.findFirst>>;
  if (email) {
    existing = await prisma.lead.findFirst({
      where: { orgId: input.orgId, email },
    });
  }
  if (!existing && phone) {
    existing = await prisma.lead.findFirst({
      where: { orgId: input.orgId, phone },
    });
  }

  const emailConsent =
    input.emailConsent ?? Boolean(email);
  const smsConsent = input.smsConsent ?? Boolean(phone);

  if (existing) {
    const lead = await prisma.lead.update({
      where: { id: existing.id },
      data: {
        email: existing.email ?? email,
        phone: existing.phone ?? phone,
        address: existing.address ?? input.address,
        travelDates: existing.travelDates ?? input.travelDates,
        partySize: existing.partySize ?? input.partySize,
        propertyId: existing.propertyId ?? input.propertyId,
        campaignId: existing.campaignId ?? input.campaignId,
        externalRef: existing.externalRef ?? input.externalRef,
        emailConsent: existing.emailConsent || emailConsent,
        smsConsent: existing.smsConsent || smsConsent,
        emailConsentAt: existing.emailConsentAt ?? (emailConsent ? now : null),
        smsConsentAt: existing.smsConsentAt ?? (smsConsent ? now : null),
      },
    });

    const isAd = ["META", "TIKTOK", "PINTEREST"].includes(input.source);
    await prisma.leadEvent.create({
      data: {
        orgId: input.orgId,
        leadId: lead.id,
        type: isAd ? "CAPTURED" : "INQUIRY_STARTED",
        title: isAd
          ? `Lead captured: ${input.source} (merged)`
          : "Inquiry started (merged)",
        body: input.consentText,
        meta: { consentText: input.consentText, source: input.source },
        occurredAt: now,
      },
    });

    if (isAd) {
      await autoEnroll(lead.id, "AD_LEAD_CAPTURED", { now });
    }

    return { leadId: lead.id, created: false, merged: true };
  }

  const isAd = ["META", "TIKTOK", "PINTEREST"].includes(input.source);
  const lead = await prisma.lead.create({
    data: {
      orgId: input.orgId,
      name: input.name,
      email,
      phone,
      address: input.address,
      travelDates: input.travelDates,
      partySize: input.partySize,
      source: input.source,
      propertyId: input.propertyId,
      campaignId: input.campaignId,
      externalRef: input.externalRef,
      emailConsent,
      smsConsent,
      emailConsentAt: emailConsent ? now : null,
      smsConsentAt: smsConsent ? now : null,
      stage: "NEW",
      isDemo: input.isDemo ?? false,
      createdAt: now,
    },
  });

  await prisma.leadEvent.create({
    data: {
      orgId: input.orgId,
      leadId: lead.id,
      type: isAd ? "CAPTURED" : "INQUIRY_STARTED",
      title: isAd
        ? `Lead captured: ${prettySource(input.source)} instant form`
        : "Inquiry started: direct site",
      body: input.consentText,
      meta: { consentText: input.consentText, source: input.source },
      occurredAt: now,
    },
  });

  if (input.campaignId) {
    await prisma.campaign.update({
      where: { id: input.campaignId },
      data: { leadsCount: { increment: 1 } },
    });
  }

  if (isAd) {
    await autoEnroll(lead.id, "AD_LEAD_CAPTURED", { now });
  } else if (input.source === "DIRECT_SITE") {
    // Abandonment enrollment happens in tick phase 3 after window
  }

  // Auto-enrich new leads when the org opted in (best-effort, gated on plan).
  void maybeAutoEnrich(lead.orgId, lead.id).catch(() => {});

  return { leadId: lead.id, created: true, merged: false };
}

/** Fire enrichment for a fresh lead if the org enabled auto-enrich + is paid. */
async function maybeAutoEnrich(orgId: string, leadId: string): Promise<void> {
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { enrichAuto: true, plan: true },
  });
  if (!org?.enrichAuto) return;
  if (org.plan !== "GROWTH" && org.plan !== "ENTERPRISE") return;
  const { enrichLead } = await import("../enrichment/enrich");
  await enrichLead(orgId, leadId);
}

function prettySource(s: LeadSource): string {
  switch (s) {
    case "META":
      return "Meta";
    case "TIKTOK":
      return "TikTok";
    case "PINTEREST":
      return "Pinterest";
    default:
      return s;
  }
}

export async function changeStage(
  leadId: string,
  stage: "NEW" | "CONTACTED" | "ENGAGED" | "QUOTED" | "BOOKED" | "LOST",
  opts?: { bookingAmountCents?: number; now?: Date },
) {
  const now = opts?.now ?? new Date();
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: {
      stage,
      needsAttention: stage === "BOOKED" || stage === "LOST" ? false : lead.needsAttention,
    },
  });

  await prisma.leadEvent.create({
    data: {
      orgId: lead.orgId,
      leadId,
      type: stage === "BOOKED" ? "BOOKED" : stage === "LOST" ? "LOST_MARKED" : "STAGE_CHANGED",
      title:
        stage === "BOOKED"
          ? `Booked${opts?.bookingAmountCents ? `: $${(opts.bookingAmountCents / 100).toFixed(0)}` : ""}`
          : stage === "LOST"
            ? "Marked lost"
            : `Stage → ${stage}`,
      occurredAt: now,
    },
  });

  if (stage === "BOOKED" || stage === "LOST") {
    await stopActiveEnrollments(leadId, stage === "BOOKED" ? "Booked" : "Marked lost", {
      now,
    });
  }

  if (stage === "BOOKED") {
    // Touchpoint attribution: the most recent sequence this lead was enrolled
    // in gets credit alongside the capturing campaign.
    const lastEnrollment = await prisma.enrollment.findFirst({
      where: { leadId },
      orderBy: { createdAt: "desc" },
      select: { sequenceId: true },
    });
    await prisma.booking.create({
      data: {
        orgId: lead.orgId,
        leadId,
        propertyId: lead.propertyId,
        amountCents: opts?.bookingAmountCents,
        bookedAt: now,
        attributedCampaignId: lead.campaignId,
        attributedSequenceId: lastEnrollment?.sequenceId ?? null,
      },
    });

    // Review flywheel: ask for a review after a booking (best-effort, gated).
    const org = await prisma.org.findUnique({
      where: { id: lead.orgId },
      select: { reviewEnabled: true },
    });
    if (org?.reviewEnabled) {
      const { sendReviewRequest } = await import("../engines/review");
      void sendReviewRequest(lead.orgId, leadId, now).catch(() => {});
    }
  }

  return updated;
}

export async function recordInbound(opts: {
  leadId: string;
  text: string;
  channel?: "EMAIL" | "SMS";
  now?: Date;
}) {
  const now = opts.now ?? new Date();
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: opts.leadId } });
  const channel = opts.channel ?? "SMS";
  const text = opts.text.trim();

  // STOP handling
  if (channel === "SMS" && /^stop$/i.test(text)) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { smsStoppedAt: now, smsConsent: false },
    });
    await prisma.leadEvent.create({
      data: {
        orgId: lead.orgId,
        leadId: lead.id,
        type: "OPTED_OUT",
        channel: "SMS",
        title: "SMS opted out (STOP)",
        occurredAt: now,
      },
    });
    return { optedOut: true as const };
  }

  await prisma.leadEvent.create({
    data: {
      orgId: lead.orgId,
      leadId: lead.id,
      type: "REPLIED",
      channel,
      title: channel === "SMS" ? "SMS reply" : "Replied to email",
      body: text,
      occurredAt: now,
    },
  });

  await pauseActiveEnrollments(lead.id, "Lead replied", { now });

  // Stage bump NEW/CONTACTED → ENGAGED
  if (lead.stage === "NEW" || lead.stage === "CONTACTED") {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { stage: "ENGAGED", needsAttention: true },
    });
    await prisma.leadEvent.create({
      data: {
        orgId: lead.orgId,
        leadId: lead.id,
        type: "STAGE_CHANGED",
        title: "Stage → Engaged",
        body: "Lead replied",
        occurredAt: now,
      },
    });
  } else {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { needsAttention: true },
    });
  }

  // AI reply/booking agent (best-effort; gated + guarded inside).
  const { handleInboundForAgent } = await import("../ai/agent/onReply");
  await handleInboundForAgent({
    orgId: lead.orgId,
    leadId: lead.id,
    incomingText: text,
    channel,
    now,
  });

  return { optedOut: false as const };
}

export { pauseActiveEnrollments };
