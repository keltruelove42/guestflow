import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";

export const dynamic = "force-dynamic";

/** Lightweight health check: app up + database reachable. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "connected" });
  } catch {
    return NextResponse.json({ ok: false, db: "error" }, { status: 503 });
  }
}
