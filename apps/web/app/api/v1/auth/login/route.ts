import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { hashPassword, verifyPassword } from "@guestflow/core";
import { SESSION_COOKIE, signSession } from "@/lib/session";

/**
 * Password login. Accounts created before passwords existed set theirs
 * on first login (first successful login claims the password).
 */
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

  const user = await prisma.user.findUnique({ where: { email } });
  // Uniform error to avoid confirming which emails exist
  const badCreds = NextResponse.json(
    { error: "Email or password is incorrect" },
    { status: 401 },
  );
  if (!user) return badCreds;

  if (!user.passwordHash) {
    // Legacy account from before passwords: this login sets the password.
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Set a password of at least 8 characters to secure this account" },
        { status: 400 },
      );
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password) },
    });
  } else {
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return badCreds;
  }

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
