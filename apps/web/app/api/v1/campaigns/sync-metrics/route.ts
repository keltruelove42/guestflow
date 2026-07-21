import { NextResponse } from "next/server";
import { syncCampaignMetrics } from "@guestflow/core";
import { getSession } from "@/lib/auth";

/** Manual metrics sync (also runs on jobs/tick). */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await syncCampaignMetrics(session.orgId);
  return NextResponse.json(result);
}
