import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { prisma } from "@guestflow/db";
import { autoEnroll, pauseEnrollment, resumeEnrollment, stopEnrollment } from "../sequences/autoEnroll";
import { createFromCapture } from "./capture";
import { processScheduledMessage } from "../messaging/process";

const TEST_EMAIL = `engine-test-${Date.now()}@guestflow.test`;

describe("autoEnroll + process (db)", () => {
  let orgId: string;
  let propertyId: string;
  let sequenceId: string;
  let campaignId: string;

  beforeAll(async () => {
    const org = await prisma.org.create({
      data: {
        name: "Engine Test Org",
        mode: "DEMO",
        timezone: "America/New_York",
        quietStart: 21,
        quietEnd: 9,
      },
    });
    orgId = org.id;
    await prisma.user.create({
      data: {
        id: `test_${Date.now()}`,
        orgId,
        email: TEST_EMAIL,
        name: "Taylor",
      },
    });
    const prop = await prisma.property.create({
      data: { orgId, name: "Test Cabin", location: "NC" },
    });
    propertyId = prop.id;
    const seq = await prisma.sequence.create({
      data: {
        orgId,
        name: "Test Welcome",
        trigger: "AD_LEAD_CAPTURED",
        active: true,
        steps: {
          create: [
            {
              order: 0,
              delayMinutes: 0,
              channel: "EMAIL",
              subject: "Welcome {{first_name}}",
              body: "Thanks for interest in {{property}}.{{unsub_link}}",
            },
            {
              order: 1,
              delayMinutes: 60,
              channel: "SMS",
              body: "Hi {{first_name}} from {{host_name}} — reply STOP to opt out",
            },
          ],
        },
      },
    });
    sequenceId = seq.id;
    const camp = await prisma.campaign.create({
      data: {
        orgId,
        propertyId,
        platform: "META",
        name: "Test Camp",
        dailyBudgetCents: 1000,
        audience: {},
        leadForm: [],
        autoEnrollSequenceId: sequenceId,
        status: "ACTIVE",
      },
    });
    campaignId = camp.id;
  });

  afterAll(async () => {
    await prisma.scheduledMessage.deleteMany({ where: { orgId } });
    await prisma.enrollment.deleteMany({ where: { orgId } });
    await prisma.leadEvent.deleteMany({ where: { orgId } });
    await prisma.lead.deleteMany({ where: { orgId } });
    await prisma.sequenceStep.deleteMany({ where: { sequence: { orgId } } });
    await prisma.sequence.deleteMany({ where: { orgId } });
    await prisma.campaign.deleteMany({ where: { orgId } });
    await prisma.property.deleteMany({ where: { orgId } });
    await prisma.user.deleteMany({ where: { orgId } });
    await prisma.org.delete({ where: { id: orgId } });
  });

  it("autoEnrolls ad lead and sends instant step", async () => {
    // Midday ET so quiet hours (21–9) don't defer the instant welcome
    const now = new Date("2026-07-15T16:00:00Z");
    const { leadId, created } = await createFromCapture({
      orgId,
      name: "Hannah Cole",
      email: "hannah.cole@example.com",
      source: "META",
      propertyId,
      campaignId,
      externalRef: `ext_${Date.now()}`,
      emailConsent: true,
      consentText: "I agree",
      now,
    });
    expect(created).toBe(true);

    const enrollment = await prisma.enrollment.findFirst({
      where: { leadId, sequenceId },
    });
    expect(enrollment?.status).toBe("ACTIVE");

    const events = await prisma.leadEvent.findMany({
      where: { leadId },
      orderBy: { occurredAt: "asc" },
    });
    expect(events.some((e) => e.type === "ENROLLED")).toBe(true);
    expect(events.some((e) => e.type === "EMAIL_SENT")).toBe(true);

    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead.stage).toBe("CONTACTED");
  });

  it("dedupes active enrollment", async () => {
    const lead = await prisma.lead.findFirstOrThrow({
      where: { orgId, email: "hannah.cole@example.com" },
    });
    const r = await autoEnroll(lead.id, "AD_LEAD_CAPTURED", { processInstant: false });
    expect(r.enrolled).toBe(false);
  });

  it("pauses on reply hold; resume pushes sendAt", async () => {
    const lead = await prisma.lead.findFirstOrThrow({
      where: { orgId, email: "hannah.cole@example.com" },
    });
    const enrollment = await prisma.enrollment.findFirstOrThrow({
      where: { leadId: lead.id, status: "ACTIVE" },
    });
    await pauseEnrollment(enrollment.id, "Lead replied");
    const paused = await prisma.enrollment.findUniqueOrThrow({
      where: { id: enrollment.id },
    });
    expect(paused.status).toBe("PAUSED");

    // Due message should be held while paused
    const pending = await prisma.scheduledMessage.findFirst({
      where: { enrollmentId: enrollment.id, status: "PENDING" },
    });
    if (pending) {
      await prisma.scheduledMessage.update({
        where: { id: pending.id },
        data: { sendAt: new Date(Date.now() - 1000) },
      });
      const r = await processScheduledMessage(pending.id);
      expect(r.status).toBe("HELD");
    }

    const now = new Date();
    await resumeEnrollment(enrollment.id, { now });
    const after = await prisma.scheduledMessage.findFirst({
      where: { enrollmentId: enrollment.id, status: "PENDING" },
    });
    if (after) {
      expect(after.sendAt.getTime()).toBeGreaterThanOrEqual(now.getTime() + 55 * 60_000);
    }
  });

  it("BOOKED stops and cancels pending", async () => {
    const now = new Date("2026-07-15T16:00:00Z");
    const { leadId } = await createFromCapture({
      orgId,
      name: "Book Me",
      email: `book.${Date.now()}@example.com`,
      source: "META",
      propertyId,
      campaignId,
      externalRef: `book_${Date.now()}`,
      emailConsent: true,
      now,
    });
    const enrollment = await prisma.enrollment.findFirstOrThrow({
      where: { leadId, status: "ACTIVE" },
    });
    await stopEnrollment(enrollment.id, "Booked");
    const stopped = await prisma.enrollment.findUniqueOrThrow({
      where: { id: enrollment.id },
    });
    expect(stopped.status).toBe("STOPPED");
    const pending = await prisma.scheduledMessage.count({
      where: { enrollmentId: enrollment.id, status: "PENDING" },
    });
    expect(pending).toBe(0);
  });

  it("idempotent: processing SENT message twice is ALREADY_DONE", async () => {
    const sent = await prisma.scheduledMessage.findFirst({
      where: { orgId, status: "SENT" },
    });
    expect(sent).toBeTruthy();
    const r = await processScheduledMessage(sent!.id, {
      now: new Date("2026-07-15T16:00:00Z"),
    });
    expect(r.status).toBe("ALREADY_DONE");
  });
});
