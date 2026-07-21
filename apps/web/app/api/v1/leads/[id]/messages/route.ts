import { NextResponse } from "next/server";
import { sendMessageSchema } from "@guestflow/shared";
import { sendManualMessage } from "@guestflow/core";
import { getSession } from "@/lib/auth";

type Ctx = { params: { id: string } };

export async function POST(req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().formErrors.join(", ") || "Invalid message" },
      { status: 400 },
    );
  }

  if (parsed.data.channel === "CALL") {
    return NextResponse.json(
      { error: "Use a call task instead — only email and SMS can be sent" },
      { status: 400 },
    );
  }

  try {
    const result = await sendManualMessage({
      orgId: session.orgId,
      leadId: params.id,
      channel: parsed.data.channel,
      subject: parsed.data.subject,
      body: parsed.data.body,
      viaAi: parsed.data.viaAi,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
