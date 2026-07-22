import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@guestflow/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [users, invites] = await Promise.all([
    prisma.user.findMany({
      where: { orgId: session.orgId },
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { orgId: session.orgId, acceptedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, email: true, token: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return NextResponse.json({ users, invites });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json(
      { error: "That email already has a LeadCoda account" },
      { status: 409 },
    );
  }

  const token = randomBytes(24).toString("hex");
  const invite = await prisma.invitation.create({
    data: {
      orgId: session.orgId,
      email,
      token,
      expiresAt: new Date(Date.now() + 7 * 864e5),
    },
  });

  // Best-effort invite email; the copyable link in the UI is the fallback
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const link = `${appUrl}/join/${token}`;
  try {
    const org = await prisma.org.findUniqueOrThrow({
      where: { id: session.orgId },
      select: { name: true },
    });
    const { getEmailSender } = await import("@guestflow/core");
    const sender = await getEmailSender(session.orgId);
    await sender.send({
      to: email,
      subject: `You are invited to ${org.name} on LeadCoda`,
      text: `${session.name ?? session.email} invited you to join ${org.name} on LeadCoda.\n\nAccept here (link valid for 7 days): ${link}`,
      html: `${session.name ?? session.email} invited you to join <b>${org.name}</b> on LeadCoda.<br/><br/><a href="${link}">Accept the invite</a> (valid for 7 days).`,
    });
  } catch {
    /* best effort */
  }

  return NextResponse.json({ id: invite.id, email, link });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.invitation.deleteMany({ where: { id, orgId: session.orgId } });
  return NextResponse.json({ ok: true });
}
