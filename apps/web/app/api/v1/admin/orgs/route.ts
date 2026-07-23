import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { isPlatformAdmin } from "@guestflow/core";
import { getSession } from "@/lib/auth";

/**
 * GET /api/v1/admin/orgs — platform-admin only. Every workspace with usage
 * stats: plan, mode, trial end, users, leads, sends, last activity.
 */
export async function GET() {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session.email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const orgs = await prisma.org.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      plan: true,
      mode: true,
      vertical: true,
      trialEndsAt: true,
      createdAt: true,
      users: { select: { email: true }, orderBy: { createdAt: "asc" }, take: 1 },
      _count: { select: { users: true, leads: true, sequences: true } },
    },
  });

  // Send counts + last activity in two grouped queries instead of per-org.
  const [sendCounts, lastEvents, bookingCounts] = await Promise.all([
    prisma.leadEvent.groupBy({
      by: ["orgId", "type"],
      where: { type: { in: ["EMAIL_SENT", "SMS_SENT", "MANUAL_MESSAGE", "AI_REPLY_SENT"] } },
      _count: { _all: true },
    }),
    prisma.leadEvent.groupBy({
      by: ["orgId"],
      _max: { occurredAt: true },
    }),
    prisma.booking.groupBy({
      by: ["orgId"],
      _count: { _all: true },
    }),
  ]);

  const sends = new Map<string, number>();
  for (const row of sendCounts) {
    sends.set(row.orgId, (sends.get(row.orgId) ?? 0) + row._count._all);
  }
  const lastActivity = new Map(lastEvents.map((r) => [r.orgId, r._max.occurredAt]));
  const bookings = new Map(bookingCounts.map((r) => [r.orgId, r._count._all]));

  return NextResponse.json(
    orgs.map((o) => ({
      id: o.id,
      name: o.name,
      ownerEmail: o.users[0]?.email ?? null,
      plan: o.plan,
      mode: o.mode,
      vertical: o.vertical,
      trialEndsAt: o.trialEndsAt,
      createdAt: o.createdAt,
      userCount: o._count.users,
      leadCount: o._count.leads,
      sequenceCount: o._count.sequences,
      totalSends: sends.get(o.id) ?? 0,
      bookings: bookings.get(o.id) ?? 0,
      lastActivityAt: lastActivity.get(o.id) ?? null,
    })),
  );
}
