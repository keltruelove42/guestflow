import { prisma, Prisma } from "@guestflow/db";

export type ClearDemoResult = {
  leads: number;
  properties: number;
  campaigns: number;
  sequences: number;
  availability: number;
  integrationsReset: number;
};

/**
 * Delete every row tagged isDemo for an org.
 * Real (user-created) rows are left untouched.
 *
 * `clearTemplates` also removes demo *template sequences* that have no real
 * (non-demo) lead enrollments. This is used by the demo re-seed / restore path
 * so a workspace can't accumulate stale sequences from a previous vertical
 * (e.g. rental sequences lingering in a SaaS workspace). Live follow-ups on
 * real leads are always preserved. The standalone "Clear demo data" button
 * leaves templates in place (default), so users keep their starter templates.
 */
export async function clearDemoData(
  orgId: string,
  opts?: { clearTemplates?: boolean },
): Promise<ClearDemoResult> {
  // Leads cascade: events, notes, enrollments→scheduled, bookings
  const demoLeadIds = (
    await prisma.lead.findMany({
      where: { orgId, isDemo: true },
      select: { id: true },
    })
  ).map((l) => l.id);

  // NOTE: template sequences (isDemo) are preserved, and so are any
  // enrollments of REAL leads in them — clearing demo data must never
  // interrupt live follow-ups.

  if (demoLeadIds.length) {
    await prisma.scheduledMessage.deleteMany({
      where: { enrollment: { leadId: { in: demoLeadIds } } },
    });
    await prisma.enrollment.deleteMany({ where: { leadId: { in: demoLeadIds } } });
    await prisma.booking.deleteMany({ where: { leadId: { in: demoLeadIds } } });
    await prisma.note.deleteMany({ where: { leadId: { in: demoLeadIds } } });
    await prisma.leadEvent.deleteMany({ where: { leadId: { in: demoLeadIds } } });
  }

  const leads = (
    await prisma.lead.deleteMany({ where: { orgId, isDemo: true } })
  ).count;

  const campaigns = (
    await prisma.campaign.deleteMany({ where: { orgId, isDemo: true } })
  ).count;

  // Template sequences (isDemo) are KEPT by default — they are reusable
  // templates, not clearable demo rows. On a re-seed (clearTemplates), we
  // remove demo templates that have NO real-lead enrollments so a workspace
  // can't carry stale sequences from a previous vertical into the new seed.
  let sequences = 0;
  if (opts?.clearTemplates) {
    const demoSeqs = await prisma.sequence.findMany({
      where: { orgId, isDemo: true },
      select: {
        id: true,
        _count: { select: { enrollments: { where: { lead: { isDemo: false } } } } },
      },
    });
    const removable = demoSeqs.filter((s) => s._count.enrollments === 0).map((s) => s.id);
    if (removable.length) {
      await prisma.scheduledMessage.deleteMany({
        where: { enrollment: { sequenceId: { in: removable } } },
      });
      await prisma.enrollment.deleteMany({ where: { sequenceId: { in: removable } } });
      sequences = (
        await prisma.sequence.deleteMany({ where: { id: { in: removable } } })
      ).count;
    }
  }

  const availability = (
    await prisma.availabilityBlock.deleteMany({ where: { orgId, isDemo: true } })
  ).count;

  // Null out campaign refs on any leftover leads pointing at deleted campaigns — already deleted demo leads

  const properties = (
    await prisma.property.deleteMany({ where: { orgId, isDemo: true } })
  ).count;

  // Demo integrations: disconnect rather than delete (cards stay visible)
  const integrationsReset = (
    await prisma.integration.updateMany({
      where: { orgId, isDemo: true },
      data: {
        status: "DISCONNECTED",
        lastSyncAt: null,
        lastError: null,
        credentials: Prisma.DbNull,
        isDemo: false,
      },
    })
  ).count;

  await prisma.org.update({
    where: { id: orgId },
    data: { demoClearedAt: new Date() },
  });

  return {
    leads,
    properties,
    campaigns,
    sequences,
    availability,
    integrationsReset,
  };
}

export async function demoDataCounts(orgId: string) {
  const [leads, properties, campaigns, sequences] = await Promise.all([
    prisma.lead.count({ where: { orgId, isDemo: true } }),
    prisma.property.count({ where: { orgId, isDemo: true } }),
    prisma.campaign.count({ where: { orgId, isDemo: true } }),
    prisma.sequence.count({ where: { orgId, isDemo: true } }),
  ]);
  return {
    leads,
    properties,
    campaigns,
    sequences, // templates — reported for display, NOT clearable
    total: leads + properties + campaigns,
  };
}
