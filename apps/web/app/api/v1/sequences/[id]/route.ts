import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { getSession } from "@/lib/auth";

type Ctx = { params: { id: string } };

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.sequence.findFirst({
    where: { id: params.id, orgId: session.orgId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { name, trigger, active, steps } = body as {
    name?: string;
    trigger?: string;
    active?: boolean;
    steps?: Array<{
      delayMinutes: number;
      channel: "EMAIL" | "SMS" | "CALL";
      subject?: string | null;
      body: string;
    }>;
  };

  if (steps) {
    await prisma.sequenceStep.deleteMany({ where: { sequenceId: params.id } });
    await prisma.sequenceStep.createMany({
      data: steps.map((s, i) => ({
        sequenceId: params.id,
        order: i,
        delayMinutes: s.delayMinutes,
        channel: s.channel,
        subject: s.channel === "SMS" ? null : s.subject ?? null,
        body: s.body,
      })),
    });
    // Future pending messages for edited steps: cancel orphaned pending for this sequence's enrollments
    // DECISION: cancel PENDING that reference deleted step ids; new steps get scheduled on advance only
    const validStepIds = (
      await prisma.sequenceStep.findMany({
        where: { sequenceId: params.id },
        select: { id: true },
      })
    ).map((s) => s.id);
    await prisma.scheduledMessage.updateMany({
      where: {
        status: "PENDING",
        enrollment: { sequenceId: params.id },
        stepId: { notIn: validStepIds },
      },
      data: { status: "CANCELED" },
    });
  }

  const sequence = await prisma.sequence.update({
    where: { id: params.id },
    data: {
      ...(name != null ? { name } : {}),
      ...(trigger != null ? { trigger: trigger as never } : {}),
      ...(active != null ? { active } : {}),
    },
    include: { steps: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json(sequence);
}
