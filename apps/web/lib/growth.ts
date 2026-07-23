import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { getSession } from "@/lib/auth";

/**
 * Shared Growth/Enterprise gate for analytics API routes.
 * Returns the session on success, or a NextResponse to return on failure.
 */
export async function requireGrowth(): Promise<
  | { ok: true; session: NonNullable<Awaited<ReturnType<typeof getSession>>> }
  | { ok: false; response: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const org = await prisma.org.findUniqueOrThrow({
    where: { id: session.orgId },
    select: { plan: true },
  });
  if (org.plan !== "GROWTH" && org.plan !== "ENTERPRISE") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Custom reports are included with the Growth plan." },
        { status: 403 },
      ),
    };
  }
  return { ok: true, session };
}
