import { prisma } from "@guestflow/db";

/**
 * Permanently delete an org and ALL of its data. Platform-admin only —
 * callers are responsible for authorization and confirmation UX.
 * Deletes in FK-safe order (children before parents); every model below
 * carries orgId directly.
 */
export async function deleteOrg(orgId: string): Promise<void> {
  await prisma.$transaction([
    prisma.scheduledMessage.deleteMany({ where: { orgId } }),
    prisma.enrollment.deleteMany({ where: { orgId } }),
    prisma.booking.deleteMany({ where: { orgId } }),
    prisma.note.deleteMany({ where: { orgId } }),
    prisma.leadEvent.deleteMany({ where: { orgId } }),
    prisma.appointment.deleteMany({ where: { orgId } }),
    prisma.lead.deleteMany({ where: { orgId } }),
    prisma.availabilityBlock.deleteMany({ where: { orgId } }),
    prisma.property.deleteMany({ where: { orgId } }),
    prisma.campaign.deleteMany({ where: { orgId } }),
    prisma.sequence.deleteMany({ where: { orgId } }), // steps cascade
    prisma.integration.deleteMany({ where: { orgId } }),
    prisma.invitation.deleteMany({ where: { orgId } }),
    prisma.generatedImage.deleteMany({ where: { orgId } }),
    prisma.brandSettings.deleteMany({ where: { orgId } }),
    prisma.user.deleteMany({ where: { orgId } }),
    prisma.org.delete({ where: { id: orgId } }),
  ]);
}
