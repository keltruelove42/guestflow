import { NextResponse } from "next/server";
import { getDashboardKpis } from "@guestflow/core";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const propertyId = new URL(req.url).searchParams.get("propertyId");
  const data = await getDashboardKpis(session.orgId, propertyId);
  return NextResponse.json(data);
}
