import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sequences = await prisma.sequence.findMany({
    where: { orgId: session.orgId },
    include: {
      steps: { orderBy: { order: "asc" } },
      enrollments: {
        select: {
          id: true,
          status: true,
          lead: { select: { stage: true, events: { where: { type: "REPLIED" }, take: 1 } } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const items = sequences.map((s) => {
    const enrolled = s.enrollments.length;
    const replies = s.enrollments.filter((e) => e.lead.events.length > 0).length;
    const booked = s.enrollments.filter((e) => e.lead.stage === "BOOKED").length;
    const channels = [...new Set(s.steps.map((st) => st.channel))];
    const channelLabel = (() => {
      const hasEmail = channels.includes("EMAIL");
      const hasSms = channels.includes("SMS");
      const hasCall = channels.includes("CALL");
      const parts = [
        hasEmail ? "Email" : null,
        hasSms ? "SMS" : null,
        hasCall ? "Call" : null,
      ].filter(Boolean);
      return parts.join(" + ") || "Mixed";
    })();
    return {
      id: s.id,
      name: s.name,
      trigger: s.trigger,
      active: s.active,
      createdAt: s.createdAt,
      steps: s.steps,
      channelLabel,
      isDemo: s.isDemo,
      stats: {
        enrolled,
        replies,
        replyRate: enrolled ? Math.round((100 * replies) / enrolled) : 0,
        booked,
      },
    };
  });

  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, trigger, active = true, steps, heroPhotoUrl } = body as {
    name: string;
    trigger: string;
    active?: boolean;
    heroPhotoUrl?: string | null;
    steps?: Array<{
      delayMinutes: number;
      channel: "EMAIL" | "SMS" | "CALL";
      subject?: string | null;
      body: string;
    }>;
  };

  if (!name || !trigger || !Array.isArray(steps) || steps.length === 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (heroPhotoUrl !== undefined && heroPhotoUrl !== null) {
    if (
      typeof heroPhotoUrl !== "string" ||
      !/^https?:\/\//.test(heroPhotoUrl) ||
      heroPhotoUrl.length > 2048
    ) {
      return NextResponse.json({ error: "Invalid heroPhotoUrl" }, { status: 400 });
    }
  }

  const sequence = await prisma.sequence.create({
    data: {
      orgId: session.orgId,
      name,
      trigger: trigger as never,
      active,
      isDemo: false,
      heroPhotoUrl: heroPhotoUrl ?? null,
      steps: {
        create: steps.map((s, i) => ({
          order: i,
          delayMinutes: s.delayMinutes,
          channel: s.channel,
          subject: s.channel === "SMS" ? null : s.subject ?? null,
          body: s.body,
        })),
      },
    },
    include: { steps: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json(sequence, { status: 201 });
}
