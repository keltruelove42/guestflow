import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { referralLink, referralStats } from "@guestflow/core";
import { getSession } from "@/lib/auth";

/** GET /api/v1/org/referral — the org's referral link + stats. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await prisma.org.findUniqueOrThrow({
    where: { id: session.orgId },
    select: { bookingSlug: true },
  });
  const appUrl = process.env.APP_URL ?? "";
  const stats = await referralStats(session.orgId);
  return NextResponse.json({
    slug: org.bookingSlug,
    link: org.bookingSlug && appUrl ? referralLink(appUrl, org.bookingSlug) : null,
    stats,
  });
}
