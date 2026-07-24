import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { safeColor } from "@guestflow/core";
import { getSession } from "@/lib/auth";

const DEFAULTS = {
  logoUrl: null as string | null,
  primaryColor: "#1a1a2e",
  accentColor: "#047857",
  businessName: null as string | null,
  font: null as string | null,
};

const FONTS = new Set(["system", "serif", "mono"]);

/** GET /api/v1/org/brand — the org's brand settings (defaults if unset). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const brand = await prisma.brandSettings.findUnique({
    where: { orgId: session.orgId },
  });
  if (!brand) return NextResponse.json({ ...DEFAULTS, exists: false });

  return NextResponse.json({
    logoUrl: brand.logoUrl,
    primaryColor: brand.primaryColor,
    accentColor: brand.accentColor,
    businessName: brand.businessName,
    font: brand.font,
    exists: true,
  });
}

/** PUT /api/v1/org/brand — upsert the single brand row for this org. */
export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    logoUrl?: string | null;
    primaryColor?: string;
    accentColor?: string;
    businessName?: string | null;
    font?: string | null;
  } | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  if (body.logoUrl != null) {
    if (
      typeof body.logoUrl !== "string" ||
      !/^https?:\/\//.test(body.logoUrl) ||
      body.logoUrl.length > 2048
    ) {
      return NextResponse.json({ error: "logoUrl must be an http(s) URL" }, { status: 400 });
    }
  }
  if (body.font != null && !FONTS.has(body.font)) {
    return NextResponse.json({ error: "font must be system, serif or mono" }, { status: 400 });
  }
  const businessName =
    body.businessName != null ? String(body.businessName).trim().slice(0, 120) : null;

  const data = {
    logoUrl: body.logoUrl ?? null,
    primaryColor: safeColor(body.primaryColor, DEFAULTS.primaryColor),
    accentColor: safeColor(body.accentColor, DEFAULTS.accentColor),
    businessName: businessName || null,
    font: body.font ?? null,
  };

  const brand = await prisma.brandSettings.upsert({
    where: { orgId: session.orgId },
    create: { orgId: session.orgId, ...data },
    update: data,
  });

  return NextResponse.json({
    logoUrl: brand.logoUrl,
    primaryColor: brand.primaryColor,
    accentColor: brand.accentColor,
    businessName: brand.businessName,
    font: brand.font,
    exists: true,
  });
}
