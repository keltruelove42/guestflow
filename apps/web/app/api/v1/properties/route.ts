import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { createPropertySchema } from "@guestflow/shared";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const includeArchived = searchParams.get("includeArchived") === "true";

  const properties = await prisma.property.findMany({
    where: {
      orgId: session.orgId,
      ...(includeArchived ? {} : { archived: false }),
    },
    include: {
      _count: {
        select: {
          leads: true,
          campaigns: { where: { status: "ACTIVE" } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    properties.map((p) => ({
      ...p,
      leadCount: p._count.leads,
      activeCampaignCount: p._count.campaigns,
      _count: undefined,
    })),
  );
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = createPropertySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().formErrors.join(", ") || "Invalid payload" },
      { status: 400 },
    );
  }

  const data = parsed.data;
  try {
    const property = await prisma.property.create({
      data: {
        orgId: session.orgId,
        name: data.name,
        location: data.location ?? null,
        bedrooms: data.bedrooms ?? null,
        type: data.type,
        photoUrl: data.photoUrl ?? "🏡",
        directBookingUrl: data.directBookingUrl ?? null,
        knowledgeBase: data.knowledgeBase ?? null,
        isDemo: false,
      },
    });

    return NextResponse.json(
      { ...property, leadCount: 0, activeCampaignCount: 0 },
      { status: 201 },
    );
  } catch (err) {
    console.error("[POST /properties]", err);
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: string }).code)
        : null;
    if (code === "P2003") {
      return NextResponse.json(
        { error: "Your session is out of date, sign out and sign back in, then try again." },
        { status: 401 },
      );
    }
    return NextResponse.json({ error: "Could not add property" }, { status: 500 });
  }
}
