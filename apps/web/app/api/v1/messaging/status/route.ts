import { NextResponse } from "next/server";
import { getMessagingDeliveryStatus } from "@guestflow/core";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = await getMessagingDeliveryStatus(session.orgId);
  return NextResponse.json(status);
}
