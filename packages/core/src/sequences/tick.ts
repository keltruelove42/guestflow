import { prisma } from "@guestflow/db";
import { processScheduledMessage } from "../messaging/process";
import { autoEnroll } from "./autoEnroll";
import { syncCampaignMetrics } from "../campaigns";

export type TickResult = {
  sent: number;
  skipped: number;
  deferred: number;
  abandoned: number;
  quoteTriggers: number;
  checkoutTriggers: number;
  campaignsSynced: number;
};

/**
 * Scheduler tick — four phases from docs/05.
 * Safe to run concurrently (row claim via status checks + idempotencyKey).
 */
export async function tick(opts?: {
  now?: Date;
  orgId?: string;
  limit?: number;
}): Promise<TickResult> {
  const now = opts?.now ?? new Date();
  const limit = opts?.limit ?? 100;
  const result: TickResult = {
    sent: 0,
    skipped: 0,
    deferred: 0,
    abandoned: 0,
    quoteTriggers: 0,
    checkoutTriggers: 0,
    campaignsSynced: 0,
  };

  // Phase 1: due sends
  const due = await prisma.scheduledMessage.findMany({
    where: {
      status: "PENDING",
      sendAt: { lte: now },
      ...(opts?.orgId ? { orgId: opts.orgId } : {}),
    },
    orderBy: { sendAt: "asc" },
    take: limit,
  });

  for (const msg of due) {
    const r = await processScheduledMessage(msg.id, { now });
    if (r.status === "SENT") result.sent += 1;
    else if (r.status === "SKIPPED") result.skipped += 1;
    else if (r.status === "DEFERRED") result.deferred += 1;
  }

  // Phase 2: campaign metrics drift
  const metrics = await syncCampaignMetrics(opts?.orgId);
  result.campaignsSynced = metrics.synced;

  // Phase 3: abandonment promotions
  const orgs = await prisma.org.findMany({
    where: opts?.orgId ? { id: opts.orgId } : undefined,
  });

  for (const org of orgs) {
    const cutoff = new Date(now.getTime() - org.abandonmentMinutes * 60_000);
    const candidates = await prisma.lead.findMany({
      where: {
        orgId: org.id,
        source: "DIRECT_SITE",
        stage: { in: ["NEW", "CONTACTED"] },
        createdAt: { lte: cutoff },
        events: {
          some: { type: "INQUIRY_STARTED" },
          none: { type: { in: ["INQUIRY_ABANDONED", "BOOKED"] } },
        },
        bookings: { none: {} },
      },
      take: 50,
    });

    for (const lead of candidates) {
      await prisma.leadEvent.create({
        data: {
          orgId: org.id,
          leadId: lead.id,
          type: "INQUIRY_ABANDONED",
          title: "Inquiry abandoned",
          body: `No booking after ${org.abandonmentMinutes} minutes`,
          occurredAt: now,
        },
      });
      await autoEnroll(lead.id, "INQUIRY_ABANDONED", { now });
      result.abandoned += 1;
    }

    // Phase 4a: QUOTE_UNACCEPTED_48H
    const quoteCutoff = new Date(now.getTime() - 48 * 60 * 60_000);
    const quoted = await prisma.lead.findMany({
      where: {
        orgId: org.id,
        stage: "QUOTED",
        events: {
          some: { type: "QUOTE_SENT", occurredAt: { lte: quoteCutoff } },
        },
        enrollments: {
          none: {
            status: { in: ["ACTIVE", "PAUSED"] },
            sequence: { trigger: "QUOTE_UNACCEPTED_48H" },
          },
        },
      },
      take: 50,
    });
    for (const lead of quoted) {
      const r = await autoEnroll(lead.id, "QUOTE_UNACCEPTED_48H", { now });
      if (r.enrolled) result.quoteTriggers += 1;
    }

    // Phase 4b: CHECKOUT_PLUS_90D
    const checkoutCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60_000);
    const pastGuests = await prisma.booking.findMany({
      where: {
        orgId: org.id,
        checkoutAt: { lte: checkoutCutoff, not: null },
        lead: {
          stage: { not: "LOST" },
          enrollments: {
            none: {
              status: { in: ["ACTIVE", "PAUSED"] },
              sequence: { trigger: "CHECKOUT_PLUS_90D" },
            },
          },
        },
      },
      take: 50,
    });
    for (const b of pastGuests) {
      const r = await autoEnroll(b.leadId, "CHECKOUT_PLUS_90D", { now });
      if (r.enrolled) result.checkoutTriggers += 1;
    }
  }

  // Phase 5: appointment reminders (24h ahead, once per appointment)
  const upcoming = await prisma.appointment.findMany({
    where: {
      status: "SCHEDULED",
      reminderSentAt: null,
      leadId: { not: null },
      startAt: { gte: now, lte: new Date(now.getTime() + 24 * 36e5) },
    },
    include: { lead: true },
    take: 50,
  });
  for (const appt of upcoming) {
    const lead = appt.lead;
    if (!lead) continue;
    try {
      const when = appt.startAt.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
      const first = lead.name.trim().split(/\s+/)[0] || "there";
      if (lead.phone && lead.smsConsent && !lead.smsStoppedAt) {
        const { getSmsSender } = await import("../integrations");
        const sender = await getSmsSender(appt.orgId);
        await sender.send({
          to: lead.phone,
          body: `Hi ${first}! Friendly reminder about your ${appt.title} on ${when}. Reply here if you need to reschedule. (Reply STOP to opt out)`,
        });
      } else if (lead.email && lead.emailConsent && !lead.unsubscribedAt) {
        const { getEmailSender } = await import("../integrations");
        const sender = await getEmailSender(appt.orgId);
        await sender.send({
          to: lead.email,
          subject: `Reminder: ${appt.title} on ${when}`,
          text: `Hi ${first},\n\nA friendly reminder about your ${appt.title} scheduled for ${when}. Reply to this email if you need to reschedule.\n\nSee you soon!`,
          html: `Hi ${first},<br/><br/>A friendly reminder about your ${appt.title} scheduled for <b>${when}</b>. Reply to this email if you need to reschedule.<br/><br/>See you soon!`,
        });
      } else {
        // No reachable channel; mark so we do not retry forever
      }
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { reminderSentAt: now },
      });
      await prisma.leadEvent.create({
        data: {
          orgId: appt.orgId,
          leadId: lead.id,
          type: "APPOINTMENT_BOOKED",
          title: `Reminder sent: ${appt.title}`,
          occurredAt: now,
        },
      });
    } catch (err) {
      console.error("[tick] appointment reminder failed", appt.id, err);
    }
  }

  return result;
}
