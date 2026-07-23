import { NextResponse } from "next/server";
import { consumeEmailVerification } from "@guestflow/core";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/** POST /api/v1/auth/verify-email { token } — consume a verification token. */
export async function POST(req: Request) {
  const gate = rateLimit(`verify:${clientIp(req)}`, { max: 20, windowMs: 60_000 });
  if (!gate.ok) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const result = await consumeEmailVerification(String(body.token ?? ""));
  if (result.ok) return NextResponse.json({ ok: true });

  const message =
    result.reason === "expired"
      ? "This link has expired. Request a new verification email."
      : "This verification link is invalid.";
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}
