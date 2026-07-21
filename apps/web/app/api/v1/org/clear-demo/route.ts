import { NextResponse } from "next/server";
import { clearDemoData, demoDataCounts } from "@guestflow/core";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const counts = await demoDataCounts(session.orgId);
  return NextResponse.json(counts);
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const before = await demoDataCounts(session.orgId);
  if (before.total === 0) {
    return NextResponse.json({
      cleared: false,
      message: "No demo data left to clear",
      counts: before,
    });
  }

  const result = await clearDemoData(session.orgId);
  return NextResponse.json({
    cleared: true,
    message:
      "Demo data removed. Template sequences and everything you created yourself were kept.",
    deleted: result,
  });
}
