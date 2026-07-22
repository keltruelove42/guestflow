import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { parseBookingSettings, toBookingSlug } from "@guestflow/core";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await prisma.org.findUniqueOrThrow({
    where: { id: session.orgId },
    select: { bookingSlug: true, bookingSettings: true, name: true },
  });
  return NextResponse.json({
    slug: org.bookingSlug,
    settings: parseBookingSettings(org.bookingSettings),
  });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    settings?: Record<string, unknown>;
    slug?: string;
  };
  const settings = parseBookingSettings(body.settings);

  const org = await prisma.org.findUniqueOrThrow({
    where: { id: session.orgId },
    select: { id: true, name: true, bookingSlug: true },
  });

  let slug = org.bookingSlug;
  if (body.slug !== undefined) {
    const wanted = toBookingSlug(String(body.slug || org.name));
    if (wanted !== org.bookingSlug) {
      const taken = await prisma.org.findFirst({
        where: { bookingSlug: wanted, id: { not: org.id } },
        select: { id: true },
      });
      if (taken) {
        return NextResponse.json({ error: "That link name is taken" }, { status: 409 });
      }
      slug = wanted;
    }
  } else if (!slug && settings.enabled) {
    // Auto-assign on first enable
    const base = toBookingSlug(org.name);
    let candidate = base;
    for (let i = 2; i < 50; i++) {
      const taken = await prisma.org.findFirst({
        where: { bookingSlug: candidate, id: { not: org.id } },
        select: { id: true },
      });
      if (!taken) break;
      candidate = `${base}-${i}`;
    }
    slug = candidate;
  }

  await prisma.org.update({
    where: { id: org.id },
    data: {
      bookingSettings: settings as never,
      bookingSlug: slug,
    },
  });

  // Convenience: expose the booking link as a message variable
  if (settings.enabled && slug) {
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const current = await prisma.org.findUniqueOrThrow({
      where: { id: org.id },
      select: { variables: true },
    });
    const vars =
      current.variables && typeof current.variables === "object"
        ? { ...(current.variables as Record<string, unknown>) }
        : {};
    if (!vars.booking_link) {
      vars.booking_link = `${appUrl}/book/${slug}`;
      await prisma.org.update({ where: { id: org.id }, data: { variables: vars as never } });
    }
  }

  return NextResponse.json({ slug, settings });
}
