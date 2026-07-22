import { NextResponse } from "next/server";
import { loginDemoSchema } from "@guestflow/shared";
import { prisma, seedDemoOrg } from "@guestflow/db";
import { SESSION_COOKIE, signSession } from "@/lib/session";

export async function POST(req: Request) {
  // SECURITY: passwordless demo login is a development convenience only.
  // In production it is disabled unless explicitly re-enabled.
  const allowed =
    process.env.NODE_ENV === "development" ||
    process.env.ALLOW_DEMO_LOGIN === "true";
  if (!allowed) {
    return NextResponse.json(
      { error: "Demo login is disabled. Use /signup or /login" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = loginDemoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const { email, name } = parsed.data;
  let user = await prisma.user.findUnique({ where: { email }, include: { org: true } });

  if (!user) {
    // First login: create org + seed demo data (docs/06 post-login bootstrap)
    const vertical = parsed.data.vertical ?? "RENTALS";
    const seeded = await seedDemoOrg({
      email,
      userName: name ?? email.split("@")[0] ?? "Host",
      userId: `user_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
      orgName:
        (() => {
          const base = name ?? email.split("@")[0];
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
        })(),
      vertical,
    });
    user = await prisma.user.findUniqueOrThrow({
      where: { id: seeded.userId },
      include: { org: true },
    });
  }

  const token = await signSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    orgId: user.orgId,
  });

  const res = NextResponse.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      orgId: user.orgId,
    },
  });

  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}
