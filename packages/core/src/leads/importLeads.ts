import { prisma } from "@guestflow/db";
import { normalizeEmail } from "./normalize";

export type ImportRow = {
  name: string;
  email?: string | null;
  phone?: string | null;
  travelDates?: string | null;
  partySize?: string | null;
  propertyName?: string | null;
  notes?: string | null;
  /** Per-row consent override (e.g. from a provider's own subscription state) */
  emailConsent?: boolean;
  smsConsent?: boolean;
};

export type ImportInput = {
  orgId: string;
  rows: ImportRow[];
  /** User attests these contacts gave permission to be contacted. */
  emailConsent: boolean;
  smsConsent: boolean;
  /** Timeline event title, e.g. "Synced from Klaviyo" (default: import copy) */
  sourceTitle?: string;
  /** Lead source recorded on newly-created rows (default IMPORT). */
  source?: "IMPORT" | "MANUAL" | "META" | "TIKTOK" | "PINTEREST" | "DIRECT_SITE" | "WIFI";
  now?: Date;
};

export type ImportResult = {
  created: number;
  merged: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
  /** IDs of every lead touched (created or merged), in row order. */
  leadIds: string[];
};

/**
 * Bulk-import past inquiries as leads (source=IMPORT) so they can be
 * enrolled in follow-up sequences. Dedupes by email/phone (merge, like
 * live capture), resolves property by name, and records an IMPORTED
 * timeline event per lead.
 */
export async function importLeads(input: ImportInput): Promise<ImportResult> {
  const now = input.now ?? new Date();
  const result: ImportResult = { created: 0, merged: 0, skipped: 0, errors: [], leadIds: [] };

  // Resolve property names once (case-insensitive)
  const properties = await prisma.property.findMany({
    where: { orgId: input.orgId, archived: false },
    select: { id: true, name: true },
  });
  const propertyByName = new Map(
    properties.map((p) => [p.name.trim().toLowerCase(), p.id]),
  );

  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i];
    if (!row) continue;
    const name = row.name?.trim();
    const email = normalizeEmail(row.email);
    const phone = row.phone?.trim() || null;

    if (!name) {
      result.errors.push({ row: i + 1, reason: "Missing name" });
      continue;
    }
    if (!email && !phone) {
      result.errors.push({ row: i + 1, reason: "No email or phone" });
      continue;
    }

    const propertyId = row.propertyName
      ? (propertyByName.get(row.propertyName.trim().toLowerCase()) ?? null)
      : null;

    // Dedupe: merge into an existing lead with the same email or phone
    let existing = email
      ? await prisma.lead.findFirst({ where: { orgId: input.orgId, email } })
      : null;
    if (!existing && phone) {
      existing = await prisma.lead.findFirst({ where: { orgId: input.orgId, phone } });
    }

    const emailConsent = (row.emailConsent ?? input.emailConsent) && Boolean(email);
    const smsConsent = (row.smsConsent ?? input.smsConsent) && Boolean(phone);

    let leadId: string;
    if (existing) {
      const updated = await prisma.lead.update({
        where: { id: existing.id },
        data: {
          email: existing.email ?? email,
          phone: existing.phone ?? phone,
          travelDates: existing.travelDates ?? row.travelDates?.trim() ?? null,
          partySize: existing.partySize ?? row.partySize?.trim() ?? null,
          propertyId: existing.propertyId ?? propertyId,
          emailConsent: existing.emailConsent || emailConsent,
          smsConsent: existing.smsConsent || smsConsent,
          emailConsentAt: existing.emailConsentAt ?? (emailConsent ? now : null),
          smsConsentAt: existing.smsConsentAt ?? (smsConsent ? now : null),
        },
      });
      leadId = updated.id;
      result.merged++;
    } else {
      const created = await prisma.lead.create({
        data: {
          orgId: input.orgId,
          name,
          email,
          phone,
          travelDates: row.travelDates?.trim() || null,
          partySize: row.partySize?.trim() || null,
          propertyId,
          source: input.source ?? "IMPORT",
          stage: "NEW",
          emailConsent,
          smsConsent,
          emailConsentAt: emailConsent ? now : null,
          smsConsentAt: smsConsent ? now : null,
          isDemo: false,
        },
      });
      leadId = created.id;
      result.created++;
    }
    result.leadIds.push(leadId);

    await prisma.leadEvent.create({
      data: {
        orgId: input.orgId,
        leadId,
        type: "IMPORTED",
        title: input.sourceTitle
          ? existing
            ? `${input.sourceTitle} (merged with existing lead)`
            : input.sourceTitle
          : existing
            ? "Imported (merged with existing lead)"
            : "Imported past inquiry",
        body: row.notes?.trim() || null,
        meta: { rowNumber: i + 1 },
        occurredAt: now,
      },
    });

    if (row.notes?.trim()) {
      await prisma.note.create({
        data: {
          orgId: input.orgId,
          leadId,
          text: row.notes.trim(),
        },
      });
    }
  }

  return result;
}
