import { NextResponse } from "next/server";
import {
  createManagedEmailDomain,
  refreshManagedEmail,
  getManagedSendingStatus,
} from "@guestflow/core";
import { getSession } from "@/lib/auth";
import { requirePaidPlan } from "@/lib/plan";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getManagedSendingStatus(session.orgId));
}

export async function POST(req: Request) {
  // Registering a sending domain on the platform Resend account — paid only.
  const gate = await requirePaidPlan();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const body = (await req.json().catch(() => ({}))) as {
    domain?: string;
    fromLocal?: string;
    fromName?: string;
  };
  if (!body.domain?.trim()) {
    return NextResponse.json({ error: "Domain is required" }, { status: 400 });
  }
  try {
    const config = await createManagedEmailDomain({
      orgId: session.orgId,
      domain: body.domain,
      fromLocal: body.fromLocal,
      fromName: body.fromName,
    });
    return NextResponse.json(config);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not register domain" },
      { status: 400 },
    );
  }
}

/** Re-check DNS verification. */
export async function PUT() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const config = await refreshManagedEmail(session.orgId);
    return NextResponse.json(config ?? { error: "No managed domain yet" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Verification check failed" },
      { status: 400 },
    );
  }
}
