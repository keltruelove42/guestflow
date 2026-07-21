import { NextResponse } from "next/server";
import { getLeadsByWeek } from "@guestflow/core";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const weeks = Number(searchParams.get("weeks") ?? 8);
  const propertyId = searchParams.get("propertyId");
  const data = await getLeadsByWeek(session.orgId, { weeks, propertyId });
  return NextResponse.json(data);
}
