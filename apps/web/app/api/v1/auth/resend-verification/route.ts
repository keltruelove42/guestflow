import { NextResponse } from "next/server";
import { issueEmailVerification } from "@guestflow/core";
import { getSession } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/** POST /api/v1/auth/resend-verification — re-send the link to the signed-in user. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Tight cap: verification emails cost sending reputation.
  const gate = rateLimit(`resend-verify:${session.sub}:${clientIp(req)}`, {
    max: 3,
    windowMs: 10 * 60_000,
  });
  if (!gate.ok) {
    return NextResponse.json(
      { error: "Please wait a few minutes before requesting another email." },
      { status: 429 },
    );
  }

  const result = await issueEmailVerification(session.sub).catch(() => ({ sent: false }));
  return NextResponse.json({ ok: true, sent: result.sent });
}
