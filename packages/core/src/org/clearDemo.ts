import { prisma } from "@guestflow/db";

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
 */
export async function clearDemoData(orgId: string): Promise<ClearDemoResult> {
  // Leads cascade: events, notes, enrollments→scheduled, bookings
  const demoLeadIds = (
    await prisma.lead.findMany({
      where: { orgId, isDemo: true },
      select: { id: true },
    })
  ).map((l) => l.id);

  const demoSeqIds = (
    await prisma.sequence.findMany({
      where: { orgId, isDemo: true },
      select: { id: true },
    })
  ).map((s) => s.id);

  // Cancel enrollments on real leads that point at demo sequences
  if (demoSeqIds.length) {
    const enrollments = await prisma.enrollment.findMany({
      where: { orgId, sequenceId: { in: demoSeqIds } },
      select: { id: true },
    });
    const enrIds = enrollments.map((e) => e.id);
    if (enrIds.length) {
      await prisma.scheduledMessage.deleteMany({
        where: { enrollmentId: { in: enrIds } },
      });
      await prisma.enrollment.deleteMany({ where: { id: { in: enrIds } } });
    }
  }

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

  // Demo sequences (steps cascade)
  const sequences = (
    await prisma.sequence.deleteMany({ where: { orgId, isDemo: true } })
  ).count;

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
        credentials: null,
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
    sequences,
    total: leads + properties + campaigns + sequences,
  };
}
