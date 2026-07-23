import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { generateApiKey } from "@guestflow/core";
import { requireGrowth } from "@/lib/growth";

/** GET /api/v1/api-keys — list this org's keys (never the raw value). */
export async function GET() {
  const gate = await requireGrowth();
  if (!gate.ok) return gate.response;

  const keys = await prisma.apiKey.findMany({
    where: { orgId: gate.session.orgId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, last4: true, lastUsedAt: true, createdAt: true },
  });
  return NextResponse.json(keys);
}

/** POST /api/v1/api-keys { label } — create a key; raw value returned once. */
export async function POST(req: Request) {
  const gate = await requireGrowth();
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => ({}))) as { label?: string };
  const label = String(body.label ?? "").trim().slice(0, 60) || "API key";

  const count = await prisma.apiKey.count({
    where: { orgId: gate.session.orgId, revokedAt: null },
  });
  if (count >= 10) {
    return NextResponse.json({ error: "Key limit reached (10). Revoke one first." }, { status: 400 });
  }

  const { raw, hash, last4 } = generateApiKey();
  const key = await prisma.apiKey.create({
    data: {
      orgId: gate.session.orgId,
      label,
      hash,
      last4,
      createdBy: gate.session.sub,
    },
    select: { id: true, label: true, last4: true, createdAt: true },
  });
  // `raw` is returned exactly once and never stored.
  return NextResponse.json({ ...key, key: raw });
}
