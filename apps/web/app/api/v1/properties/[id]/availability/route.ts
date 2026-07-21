import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { z } from "zod";
import { getSession } from "@/lib/auth";

type Ctx = { params: { id: string } };

function parseDateOnly(s: string): Date {
  // Noon UTC avoids off-by-one across timezones for @db.Date
  return new Date(`${s}T12:00:00.000Z`);
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const createBlockSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(["BOOKED", "BLOCKED", "HOLD"]).default("BLOCKED"),
  note: z.string().optional().nullable(),
});

export async function GET(req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const property = await prisma.property.findFirst({
    where: { id: params.id, orgId: session.orgId },
  });
  if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // YYYY-MM
  let rangeStart: Date | undefined;
  let rangeEnd: Date | undefined;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number) as [number, number];
    rangeStart = new Date(Date.UTC(y, m - 1, 1, 12));
    rangeEnd = new Date(Date.UTC(y, m, 0, 12)); // last day of month
  }

  const blocks = await prisma.availabilityBlock.findMany({
    where: {
      orgId: session.orgId,
      propertyId: params.id,
      ...(rangeStart && rangeEnd
        ? {
            startDate: { lte: rangeEnd },
            endDate: { gte: rangeStart },
          }
        : {}),
    },
    orderBy: { startDate: "asc" },
  });

  return NextResponse.json({
    propertyId: params.id,
    propertyName: property.name,
    month: month ?? null,
    blocks: blocks.map((b) => ({
      id: b.id,
      startDate: toDateStr(b.startDate),
      endDate: toDateStr(b.endDate),
      kind: b.kind,
      note: b.note,
    })),
  });
}

export async function POST(req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const property = await prisma.property.findFirst({
    where: { id: params.id, orgId: session.orgId },
  });
  if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = createBlockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid dates" }, { status: 400 });
  }

  const start = parseDateOnly(parsed.data.startDate);
  const end = parseDateOnly(parsed.data.endDate);
  if (end < start) {
    return NextResponse.json({ error: "endDate must be on or after startDate" }, { status: 400 });
  }

  const block = await prisma.availabilityBlock.create({
    data: {
      orgId: session.orgId,
      propertyId: params.id,
      startDate: start,
      endDate: end,
      kind: parsed.data.kind,
      note: parsed.data.note ?? null,
    },
  });

  return NextResponse.json(
    {
      id: block.id,
      startDate: toDateStr(block.startDate),
      endDate: toDateStr(block.endDate),
      kind: block.kind,
      note: block.note,
    },
    { status: 201 },
  );
}
