import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { hashPassword } from "@guestflow/core";
import { SESSION_COOKIE, signSession } from "@/lib/session";

/** GET ?token=... → invite details for the join page. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") ?? "";
  const invite = await prisma.invitation.findUnique({
    where: { token },
    include: { org: { select: { name: true } } },
  });
  if (!invite || invite.acceptedAt || invite.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Invite is invalid or expired" }, { status: 404 });
  }
  return NextResponse.json({ email: invite.email, orgName: invite.org.name });
}

/** POST { token, name, password } → create the teammate and sign in. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    name?: string;
    password?: string;
  };
  const token = String(body.token ?? "");
  const name = String(body.name ?? "").trim();
  const password = String(body.password ?? "");
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const invite = await prisma.invitation.findUnique({ where: { token } });
  if (!invite || invite.acceptedAt || invite.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Invite is invalid or expired" }, { status: 404 });
  }
  const taken = await prisma.user.findUnique({ where: { email: invite.email } });
  if (taken) {
    return NextResponse.json(
      { error: "This email already has an account. Log in instead" },
      { status: 409 },
    );
  }

  const user = await prisma.user.create({
    data: {
      id: `user_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
      orgId: invite.orgId,
      email: invite.email,
      name,
      role: "MEMBER",
      passwordHash: await hashPassword(password),
    },
  });
  await prisma.invitation.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  });

  const session = await signSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    orgId: user.orgId,
  });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
