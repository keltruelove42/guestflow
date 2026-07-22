import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { manualEnroll } from "@guestflow/core";
import { getSession } from "@/lib/auth";

const STAGES = ["NEW", "CONTACTED", "ENGAGED", "QUOTED", "BOOKED", "LOST"];

/** Bulk actions over selected leads: stage, tags, owner, enroll. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    ids?: string[];
    stage?: string;
    addTags?: string[];
    ownerId?: string | null;
    enrollSequenceId?: string;
  };
  const ids = Array.isArray(body.ids) ? body.ids.slice(0, 200) : [];
  if (!ids.length) return NextResponse.json({ error: "No leads selected" }, { status: 400 });

  // Scope to this org
  const leads = await prisma.lead.findMany({
    where: { id: { in: ids }, orgId: session.orgId },
    select: { id: true, tags: true },
  });
  if (!leads.length) return NextResponse.json({ error: "No matching leads" }, { status: 404 });

  let updated = 0;
  let enrolled = 0;
  const errors: string[] = [];

  if (body.stage) {
    const stage = String(body.stage).toUpperCase();
    if (!STAGES.includes(stage)) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
    }
    const res = await prisma.lead.updateMany({
      where: { id: { in: leads.map((l) => l.id) } },
      data: { stage: stage as never },
    });
    updated += res.count;
  }

  if (body.ownerId !== undefined) {
    const res = await prisma.lead.updateMany({
      where: { id: { in: leads.map((l) => l.id) } },
      data: { ownerId: body.ownerId || null },
    });
    updated = Math.max(updated, res.count);
  }

  if (Array.isArray(body.addTags) && body.addTags.length) {
    const clean = body.addTags.map((t) => String(t).trim()).filter(Boolean);
    for (const lead of leads) {
      const merged = Array.from(new Set([...lead.tags, ...clean])).slice(0, 20);
      await prisma.lead.update({ where: { id: lead.id }, data: { tags: merged } });
      updated += 1;
    }
  }

  if (body.enrollSequenceId) {
    for (const lead of leads) {
      try {
        const result = await manualEnroll(lead.id, body.enrollSequenceId);
        if (result.enrolled) enrolled += 1;
        else errors.push(`${lead.id}: ${result.reason}`);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : "enroll failed");
      }
    }
  }

  return NextResponse.json({ count: leads.length, updated, enrolled, errors: errors.slice(0, 5) });
}
