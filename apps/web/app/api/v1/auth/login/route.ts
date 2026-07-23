import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { verifyPassword } from "@guestflow/core";
import { SESSION_COOKIE, signSession } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/** Password login. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  // Throttle credential-stuffing: per-IP and per-email.
  const gate = rateLimit(`login:${clientIp(req)}:${email}`, { max: 8, windowMs: 60_000 });
  if (!gate.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a minute." },
      { status: 429 },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Uniform error to avoid confirming which emails exist
  const badCreds = NextResponse.json(
    { error: "Email or password is incorrect" },
    { status: 401 },
  );
  if (!user) return badCreds;

  // Never set a password during login (that let anyone claim a passwordless
  // account). Accounts without a hash must go through invite / password reset.
  if (!user.passwordHash) {
    return NextResponse.json(
      { error: "This account has no password set. Use your invite link or reset your password." },
      { status: 403 },
    );
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return badCreds;

  const token = await signSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    orgId: user.orgId,
  });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
