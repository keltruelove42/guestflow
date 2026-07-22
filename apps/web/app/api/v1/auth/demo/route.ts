import { NextResponse } from "next/server";
import { loginDemoSchema } from "@guestflow/shared";
import { prisma, seedDemoOrg } from "@guestflow/db";
import { SESSION_COOKIE, signSession } from "@/lib/session";

export async function POST(req: Request) {
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
        vertical === "TRADES"
          ? `${name ?? email.split("@")[0]}'s Services`
          : `${name ?? email.split("@")[0]}'s Stays`,
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
