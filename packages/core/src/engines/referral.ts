import { prisma } from "@guestflow/db";

/**
 * Referral engine — turn happy customers into a lead source. Each org has a
 * public referral page (reusing its booking slug); a customer can share a
 * link with `?ref=<their leadId>` so the new lead is attributed back to them.
 */

export function referralLink(appUrl: string, slug: string, refLeadId?: string): string {
  const base = `${appUrl}/refer/${slug}`;
  return refLeadId ? `${base}?ref=${refLeadId}` : base;
}

/** Capture a referred lead from the public referral page. */
export async function captureReferral(opts: {
  slug: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  refLeadId?: string | null;
  emailConsent?: boolean;
  smsConsent?: boolean;
  now?: Date;
}): Promise<{ ok: boolean; leadId?: string; error?: string }> {
  const now = opts.now ?? new Date();
  const org = await prisma.org.findUnique({
    where: { bookingSlug: opts.slug },
    select: { id: true },
  });
  if (!org) return { ok: false, error: "Business not found" };

  const name = opts.name.trim();
  const email = opts.email?.trim().toLowerCase() || null;
  const phone = opts.phone?.trim() || null;
  if (!name) return { ok: false, error: "Name is required" };
  if (!email && !phone) return { ok: false, error: "Email or phone is required" };

  // Validate the referrer belongs to this org.
  let referredById: string | null = null;
  if (opts.refLeadId) {
    const ref = await prisma.lead.findFirst({
      where: { id: opts.refLeadId, orgId: org.id },
      select: { id: true },
    });
    referredById = ref?.id ?? null;
  }

  // Dedupe by email/phone.
  const existing =
    (email && (await prisma.lead.findFirst({ where: { orgId: org.id, email } }))) ||
    (phone && (await prisma.lead.findFirst({ where: { orgId: org.id, phone } }))) ||
    null;
  if (existing) {
    await prisma.leadEvent.create({
      data: {
        orgId: org.id,
        leadId: existing.id,
        type: "REFERRAL_CAPTURED",
        title: "Referred (existing lead)",
        occurredAt: now,
        meta: { referredById },
      },
    });
    return { ok: true, leadId: existing.id };
  }

  const lead = await prisma.lead.create({
    data: {
      orgId: org.id,
      name,
      email,
      phone,
      source: "DIRECT_SITE",
      stage: "NEW",
      tags: ["referral"],
      referredById,
      emailConsent: Boolean(opts.emailConsent && email),
      smsConsent: Boolean(opts.smsConsent && phone),
      emailConsentAt: opts.emailConsent && email ? now : null,
      smsConsentAt: opts.smsConsent && phone ? now : null,
      needsAttention: true,
    },
  });
  await prisma.leadEvent.create({
    data: {
      orgId: org.id,
      leadId: lead.id,
      type: "REFERRAL_CAPTURED",
      title: referredById ? "Referred by a customer" : "Referral form submission",
      occurredAt: now,
      meta: { referredById },
    },
  });

  return { ok: true, leadId: lead.id };
}

/** Referral counts for the org (how many leads came in referred). */
export async function referralStats(orgId: string): Promise<{ referred: number; booked: number }> {
  const referred = await prisma.lead.count({
    where: { orgId, OR: [{ referredById: { not: null } }, { tags: { has: "referral" } }] },
  });
  const booked = await prisma.lead.count({
    where: {
      orgId,
      stage: "BOOKED",
      OR: [{ referredById: { not: null } }, { tags: { has: "referral" } }],
    },
  });
  return { referred, booked };
}
