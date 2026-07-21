import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";

export const dynamic = "force-dynamic";

/** Diagnostic health check — reports DB connectivity without leaking secrets. */
export async function GET() {
  const rawUrl = process.env.DATABASE_URL ?? "";
  let host = "(unset)";
  let user = "(unset)";
  if (rawUrl) {
    try {
      const u = new URL(rawUrl);
      host = u.hostname;
      user = u.username;
    } catch {
      host = "(unparseable DATABASE_URL)";
    }
  }

  try {
    const orgs = await prisma.org.count();
    return NextResponse.json({ ok: true, db: "connected", orgs, host, user });
  } catch (err) {
    const e = err as Error & { code?: string };
    return NextResponse.json(
      {
        ok: false,
        db: "error",
        name: e.name,
        code: e.code ?? null,
        message: (e.message ?? "").replace(rawUrl, "<db-url>").slice(0, 500),
        host,
        user,
        hasDbUrl: rawUrl.length > 0,
        urlLength: rawUrl.length,
      },
      { status: 200 },
    );
  }
}
