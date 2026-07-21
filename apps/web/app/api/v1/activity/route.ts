import { NextResponse } from "next/server";
import { getActivityFeed } from "@guestflow/core";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 12);
  const data = await getActivityFeed(session.orgId, Math.min(limit, 40));
  return NextResponse.json(data);
}
