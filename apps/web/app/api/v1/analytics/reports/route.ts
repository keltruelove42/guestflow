import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { metricById, type ReportSpec } from "@guestflow/core";
import { requireGrowth } from "@/lib/growth";

/** GET /api/v1/analytics/reports — saved reports for this org. */
export async function GET() {
  const gate = await requireGrowth();
  if (!gate.ok) return gate.response;

  const reports = await prisma.savedReport.findMany({
    where: { orgId: gate.session.orgId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(reports);
}

/** POST /api/v1/analytics/reports — save a report { name, spec }. */
export async function POST(req: Request) {
  const gate = await requireGrowth();
  if (!gate.ok) return gate.response;

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    spec?: ReportSpec;
  } | null;
  const name = String(body?.name ?? "").trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!body?.spec || !metricById(body.spec.metric)) {
    return NextResponse.json({ error: "Valid metric is required" }, { status: 400 });
  }

  const count = await prisma.savedReport.count({ where: { orgId: gate.session.orgId } });
  if (count >= 50) {
    return NextResponse.json({ error: "Report limit reached (50)" }, { status: 400 });
  }

  const report = await prisma.savedReport.create({
    data: {
      orgId: gate.session.orgId,
      name,
      spec: body.spec as object,
      position: count,
      createdBy: gate.session.sub,
    },
  });
  return NextResponse.json(report);
}
