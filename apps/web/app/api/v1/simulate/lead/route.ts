import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { createFromCapture } from "@guestflow/core";
import { getSession } from "@/lib/auth";

const NAMES = [
  "Hannah Cole",
  "Evan Brooks",
  "Riley Chen",
  "Sam Patel",
  "Morgan Diaz",
  "Alex Rivera",
];

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await prisma.org.findUniqueOrThrow({ where: { id: session.orgId } });
  if (org.mode !== "DEMO") {
    return NextResponse.json({ error: "Simulator is DEMO-only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const kind = (body.kind as "ad" | "abandoned") ?? "ad";
  const platform = (body.platform as "META" | "TIKTOK" | "PINTEREST") ?? "META";

  const properties = await prisma.property.findMany({
    where: { orgId: session.orgId, archived: false },
  });
  const property = properties[Math.floor(Math.random() * properties.length)];
  const name = NAMES[Math.floor(Math.random() * NAMES.length)]!;
  const slug = name.toLowerCase().replace(/[^a-z]+/g, ".");

  if (kind === "abandoned") {
    const result = await createFromCapture({
      orgId: session.orgId,
      name,
      email: Math.random() > 0.3 ? `${slug}@example.com` : null,
      phone: Math.random() > 0.4 ? `+1555${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}` : null,
      source: "DIRECT_SITE",
      propertyId: property?.id,
      travelDates: "Flexible — next month",
      emailConsent: true,
      smsConsent: true,
      externalRef: `sim_inq_${Date.now()}`,
      isDemo: true,
      // Backdate so abandonment window can fire on tick if desired
      now: new Date(Date.now() - (org.abandonmentMinutes + 5) * 60_000),
    });
    // Force inquiry-started age; createFromCapture already wrote INQUIRY_STARTED
    // Promote abandoned immediately for simulator UX
    await prisma.leadEvent.create({
      data: {
        orgId: session.orgId,
        leadId: result.leadId,
        type: "INQUIRY_ABANDONED",
        title: "Abandoned inquiry — simulated",
        body: "Simulator: abandonment window elapsed",
      },
    });
    const { autoEnroll } = await import("@guestflow/core");
    await autoEnroll(result.leadId, "INQUIRY_ABANDONED");

    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: result.leadId } });
    return NextResponse.json({ lead, kind });
  }

  const campaign = await prisma.campaign.findFirst({
    where: {
      orgId: session.orgId,
      platform,
      status: "ACTIVE",
      ...(property ? { propertyId: property.id } : {}),
    },
  });

  const result = await createFromCapture({
    orgId: session.orgId,
    name,
    email: `${slug}.${Date.now().toString(36)}@example.com`,
    phone: Math.random() > 0.5 ? `+1404${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}` : null,
    source: platform,
    propertyId: campaign?.propertyId ?? property?.id,
    campaignId: campaign?.id,
    travelDates: "Oct 9–12",
    emailConsent: true,
    smsConsent: Math.random() > 0.5,
    externalRef: `sim_ad_${Date.now()}`,
    consentText: "I agree to be contacted about this property.",
    isDemo: true,
  });

  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: result.leadId },
    include: {
      property: true,
      enrollments: { include: { sequence: true }, take: 1 },
    },
  });

  return NextResponse.json({ lead, kind: "ad" });
}
