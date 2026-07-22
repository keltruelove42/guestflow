import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { sanitizeVariables, RESERVED_TAGS } from "@guestflow/core";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await prisma.org.findUniqueOrThrow({
    where: { id: session.orgId },
    select: { variables: true },
  });
  const variables = sanitizeVariables(org.variables);
  return NextResponse.json({ variables, reserved: RESERVED_TAGS });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.variables !== "object" || Array.isArray(body.variables)) {
    return NextResponse.json({ error: "Send { variables: { key: value } }" }, { status: 400 });
  }

  const cleaned = sanitizeVariables(body.variables);
  for (const key of Object.keys(cleaned)) {
    if ((RESERVED_TAGS as readonly string[]).includes(key)) {
      delete cleaned[key];
    }
  }
  if (Object.keys(cleaned).length > 50) {
    return NextResponse.json({ error: "Maximum 50 variables" }, { status: 400 });
  }

  await prisma.org.update({
    where: { id: session.orgId },
    data: { variables: cleaned },
  });
  return NextResponse.json({ variables: cleaned });
}
