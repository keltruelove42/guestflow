import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { getSession } from "@/lib/auth";

/**
 * Require a PAID plan (anything other than TRIAL). Used to gate features that
 * cost the platform real money or reputation — e.g. managed domain/number
 * provisioning — so trial/free accounts can't abuse them.
 */
export async function requirePaidPlan(): Promise<
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
  if (org.plan === "TRIAL") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "This feature requires a paid plan. Upgrade to set up managed sending." },
        { status: 403 },
      ),
    };
  }
  return { ok: true, session };
}
