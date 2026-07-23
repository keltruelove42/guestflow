import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { requireGrowth } from "@/lib/growth";

type Ctx = { params: { id: string } };

/** DELETE /api/v1/api-keys/[id] — revoke a key. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const gate = await requireGrowth();
  if (!gate.ok) return gate.response;

  const key = await prisma.apiKey.findFirst({
    where: { id: params.id, orgId: gate.session.orgId, revokedAt: null },
    select: { id: true },
  });
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.apiKey.update({ where: { id: key.id }, data: { revokedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
