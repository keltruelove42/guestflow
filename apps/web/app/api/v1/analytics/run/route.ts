import { NextResponse } from "next/server";
import { runReport, type ReportSpec } from "@guestflow/core";
import { requireGrowth } from "@/lib/growth";

export const maxDuration = 30;

/** POST /api/v1/analytics/run — execute a report spec, return the series. */
export async function POST(req: Request) {
  const gate = await requireGrowth();
  if (!gate.ok) return gate.response;

  const spec = (await req.json().catch(() => null)) as ReportSpec | null;
  if (!spec || typeof spec.metric !== "string" || typeof spec.groupBy !== "string") {
    return NextResponse.json({ error: "Send a report spec { metric, groupBy, … }" }, { status: 400 });
  }

  try {
    const result = await runReport(gate.session.orgId, spec);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Report failed" },
      { status: 400 },
    );
  }
}
