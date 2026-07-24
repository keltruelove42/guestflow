import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET — the org's existing custom tags, most-used first. Powers tag
 * autocomplete/suggestions so users reuse their own tags instead of
 * inventing near-duplicates ("VIP" vs "vip" vs "v.i.p").
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.lead.findMany({
    where: { orgId: session.orgId, isDemo: false, tags: { isEmpty: false } },
    select: { tags: true },
    take: 5000,
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const raw of row.tags) {
      const t = String(raw).trim();
      if (!t) continue;
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }

  const tags = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 100)
    .map(([tag, count]) => ({ tag, count }));

  return NextResponse.json({ tags });
}
