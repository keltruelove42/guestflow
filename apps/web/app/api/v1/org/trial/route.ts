import { NextResponse } from "next/server";
import { getTrialStatus } from "@guestflow/core";
import { getSession } from "@/lib/auth";

/** GET /api/v1/org/trial — trial clock + credit usage for the current org. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const status = await getTrialStatus(session.orgId);
  return NextResponse.json(status);
}
