import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { canGenerateImages, isAgentConfigured } from "@guestflow/core";
import { getSession } from "@/lib/auth";

const MODES = new Set(["OFF", "SUGGEST", "AUTOPILOT"]);

/** GET /api/v1/org/ai-agent — current mode + whether the feature is available. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await prisma.org.findUniqueOrThrow({
    where: { id: session.orgId },
    select: { aiAgentMode: true, plan: true },
  });
  return NextResponse.json({
    mode: org.aiAgentMode,
    available: canGenerateImages(org.plan), // Growth/Enterprise
    configured: isAgentConfigured(),
  });
}

/** PUT /api/v1/org/ai-agent { mode } — set the agent mode (Growth/Enterprise). */
export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await prisma.org.findUniqueOrThrow({
    where: { id: session.orgId },
    select: { plan: true },
  });

  const body = (await req.json().catch(() => ({}))) as { mode?: string };
  const mode = String(body.mode ?? "").toUpperCase();
  if (!MODES.has(mode)) {
    return NextResponse.json({ error: "mode must be OFF, SUGGEST or AUTOPILOT" }, { status: 400 });
  }
  if (mode !== "OFF" && !canGenerateImages(org.plan)) {
    return NextResponse.json(
      { error: "The AI assistant is included with the Growth plan." },
      { status: 403 },
    );
  }

  await prisma.org.update({ where: { id: session.orgId }, data: { aiAgentMode: mode } });
  return NextResponse.json({ mode });
}
