import { NextResponse } from "next/server";
import { prisma, seedDemoOrg } from "@guestflow/db";
import { hashPassword } from "@guestflow/core";
import { loginDemoSchema } from "@guestflow/shared";
import { SESSION_COOKIE, signSession } from "@/lib/session";

/** Real signup: name + email + password + industry. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = loginDemoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  const password = String((body as Record<string, unknown>)?.password ?? "");
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const { email, name } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists. Log in instead" },
      { status: 409 },
    );
  }

  const vertical = parsed.data.vertical ?? "RENTALS";
  const base = name ?? email.split("@")[0];
  const orgName = (() => {
    switch (vertical) {
      case "TRADES":
        return `${base}'s Services`;
      case "BEAUTY":
        return `${base}'s Studio`;
      case "DEALERSHIPS":
        return `${base}'s Dealership`;
      case "SAAS":
        return `${base}'s Pipeline`;
      case "ECOMMERCE":
        return `${base}'s Store`;
      case "REALESTATE":
        return `${base}'s Realty`;
      case "HOTELS":
        return `${base}'s Inn`;
      default:
        return `${base}'s Stays`;
    }
  })();

  const passwordHash = await hashPassword(password);
  const seeded = await seedDemoOrg({
    email,
    userName: base ?? "Owner",
    userId: `user_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
    orgName,
    vertical,
  });
  await prisma.user.update({
    where: { id: seeded.userId },
    data: { passwordHash },
  });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: seeded.userId } });

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
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
