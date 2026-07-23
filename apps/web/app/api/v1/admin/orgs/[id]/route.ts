import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { deleteOrg, getTrialStatus, isPlatformAdmin, trialEndDate } from "@guestflow/core";
import { getSession } from "@/lib/auth";

type Ctx = { params: { id: string } };

const PLANS = new Set(["TRIAL", "STARTER", "GROWTH", "ENTERPRISE"]);

async function requireAdmin() {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session.email)) return null;
  return session;
}

/**
 * GET /api/v1/admin/orgs/[id] — org detail for the platform admin:
 * users, trial/credit usage, recent lead activity ("what leads are doing").
 */
export async function GET(_req: Request, { params }: Ctx) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const org = await prisma.org.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      plan: true,
      mode: true,
      vertical: true,
      trialEndsAt: true,
      createdAt: true,
      users: {
        select: { id: true, name: true, email: true, role: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [trial, recentEvents] = await Promise.all([
    getTrialStatus(org.id),
    prisma.leadEvent.findMany({
      where: { orgId: org.id },
      orderBy: { occurredAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        channel: true,
        title: true,
        occurredAt: true,
        lead: { select: { id: true, name: true, stage: true } },
      },
    }),
  ]);

  return NextResponse.json({ org, trial, recentEvents });
}

/**
 * PATCH /api/v1/admin/orgs/[id] — admin actions:
 *   { action: "extendTrial", days?: number }   default +7 from now or current end
 *   { action: "setPlan", plan: "TRIAL"|"STARTER"|"GROWTH"|"ENTERPRISE" }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const org = await prisma.org.findUnique({
    where: { id: params.id },
    select: { id: true, trialEndsAt: true },
  });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    days?: number;
    plan?: string;
  };

  if (body.action === "extendTrial") {
    const days = Math.min(Math.max(Math.round(body.days ?? 7), 1), 90);
    const base =
      org.trialEndsAt && org.trialEndsAt > new Date() ? org.trialEndsAt : new Date();
    const trialEndsAt = new Date(base.getTime() + days * 86_400_000);
    const updated = await prisma.org.update({
      where: { id: org.id },
      data: { trialEndsAt },
      select: { id: true, trialEndsAt: true },
    });
    return NextResponse.json({ ok: true, trialEndsAt: updated.trialEndsAt });
  }

  if (body.action === "setPlan") {
    if (!body.plan || !PLANS.has(body.plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    // Fresh trial clock when downgrading back to TRIAL keeps the org usable.
    const updated = await prisma.org.update({
      where: { id: org.id },
      data: {
        plan: body.plan,
        ...(body.plan === "TRIAL" && (!org.trialEndsAt || org.trialEndsAt < new Date())
          ? { trialEndsAt: trialEndDate() }
          : {}),
      },
      select: { id: true, plan: true, trialEndsAt: true },
    });
    return NextResponse.json({ ok: true, plan: updated.plan, trialEndsAt: updated.trialEndsAt });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

/** DELETE /api/v1/admin/orgs/[id] — permanently delete the org and all data. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  if (params.id === session.orgId) {
    return NextResponse.json(
      { error: "You can't delete your own admin workspace from here" },
      { status: 400 },
    );
  }

  const org = await prisma.org.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteOrg(org.id);
  return NextResponse.json({ ok: true });
}
