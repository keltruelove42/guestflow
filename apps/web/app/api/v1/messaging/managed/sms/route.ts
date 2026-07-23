import { NextResponse } from "next/server";
import { provisionManagedSms, type ManagedSmsInput } from "@guestflow/core";
import { requirePaidPlan } from "@/lib/plan";

export async function POST(req: Request) {
  // Provisioning buys a real Twilio number on the platform account — paid only.
  const gate = await requirePaidPlan();
  if (!gate.ok) return gate.response;
  const session = gate.session;

  const body = (await req.json().catch(() => ({}))) as Partial<ManagedSmsInput>;
  const required: Array<keyof ManagedSmsInput> = [
    "businessName",
    "businessType",
    "address",
    "contactName",
    "contactEmail",
    "contactPhone",
  ];
  for (const key of required) {
    if (!String(body[key] ?? "").trim()) {
      return NextResponse.json({ error: `${key} is required` }, { status: 400 });
    }
  }

  try {
    const config = await provisionManagedSms(session.orgId, {
      businessName: String(body.businessName),
      businessType: (body.businessType as ManagedSmsInput["businessType"]) ?? "other",
      ein: body.ein ? String(body.ein) : undefined,
      website: body.website ? String(body.website) : undefined,
      address: String(body.address),
      contactName: String(body.contactName),
      contactEmail: String(body.contactEmail),
      contactPhone: String(body.contactPhone),
      areaCode: body.areaCode ? String(body.areaCode) : undefined,
    });
    return NextResponse.json({
      fromNumber: config.fromNumber,
      a2pStatus: config.a2pStatus,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not set up texting" },
      { status: 400 },
    );
  }
}
