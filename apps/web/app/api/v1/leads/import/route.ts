import { NextResponse } from "next/server";
import { importLeadsSchema } from "@guestflow/shared";
import { importLeads } from "@guestflow/core";
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = importLeadsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid import payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await importLeads({
    orgId: session.orgId,
    rows: parsed.data.rows,
    emailConsent: parsed.data.emailConsent,
    smsConsent: parsed.data.smsConsent,
  });

  return NextResponse.json(result);
}
