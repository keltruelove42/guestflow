import { NextResponse } from "next/server";
import { prisma, seedDemoContent } from "@guestflow/db";
import { clearDemoData } from "@guestflow/core";
import { getSession } from "@/lib/auth";

/**
 * Restore the demo dataset (properties, template sequences, campaigns, leads)
 * after "Clear demo data". Real (user-created) rows are untouched: we clear
 * any leftover isDemo rows first to avoid duplicates, then re-seed.
 */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const org = await prisma.org.findUniqueOrThrow({
      where: { id: session.orgId },
      select: { vertical: true },
    });
    // clearTemplates: drop any stale demo sequences from a prior vertical
    // (with no real-lead enrollments) so the re-seed is clean for this vertical.
    await clearDemoData(session.orgId, { clearTemplates: true });
    await seedDemoContent(session.orgId, org.vertical);
    await prisma.org.update({
      where: { id: session.orgId },
      data: { demoClearedAt: null },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 300) : "Restore failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ message: "Demo data restored." });
}
