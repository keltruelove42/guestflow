import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { metricById, type ReportSpec } from "@guestflow/core";
import { requireGrowth } from "@/lib/growth";

type Ctx = { params: { id: string } };

/** PATCH /api/v1/analytics/reports/[id] — rename, re-spec, or reposition. */
export async function PATCH(req: Request, { params }: Ctx) {
  const gate = await requireGrowth();
  if (!gate.ok) return gate.response;

  const existing = await prisma.savedReport.findFirst({
    where: { id: params.id, orgId: gate.session.orgId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    spec?: ReportSpec;
    position?: number;
  };
  if (body.spec && !metricById(body.spec.metric)) {
    return NextResponse.json({ error: "Valid metric is required" }, { status: 400 });
  }

  const report = await prisma.savedReport.update({
    where: { id: params.id },
    data: {
      ...(body.name != null ? { name: String(body.name).trim().slice(0, 80) } : {}),
      ...(body.spec ? { spec: body.spec as object } : {}),
      ...(typeof body.position === "number" ? { position: body.position } : {}),
    },
  });
  return NextResponse.json(report);
}

/** DELETE /api/v1/analytics/reports/[id] */
export async function DELETE(_req: Request, { params }: Ctx) {
  const gate = await requireGrowth();
  if (!gate.ok) return gate.response;

  const existing = await prisma.savedReport.findFirst({
    where: { id: params.id, orgId: gate.session.orgId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.savedReport.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
