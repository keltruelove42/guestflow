import { NextResponse } from "next/server";
import {
  previewReactivation,
  runReactivation,
  REACTIVATION_SEGMENTS,
  type ReactivationSegment,
} from "@guestflow/core";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const IDS = new Set(REACTIVATION_SEGMENTS.map((s) => s.id));
const isSeg = (v: string): v is ReactivationSegment => IDS.has(v as ReactivationSegment);

/** GET ?segment=&channel= — segment options + reachable count preview. */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const segment = url.searchParams.get("segment") ?? "";
  const channel = url.searchParams.get("channel") === "EMAIL" ? "EMAIL" : "SMS";
  if (!isSeg(segment)) {
    return NextResponse.json({ segments: REACTIVATION_SEGMENTS });
  }
  const preview = await previewReactivation(session.orgId, segment, channel);
  return NextResponse.json({ segments: REACTIVATION_SEGMENTS, preview });
}

/** POST { segment, channel, subject?, message } — send the reactivation blast. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    segment?: string;
    channel?: string;
    subject?: string;
    message?: string;
    emergency?: boolean;
    emergencyReason?: string;
  };
  if (!isSeg(String(body.segment))) {
    return NextResponse.json({ error: "Pick a valid segment" }, { status: 400 });
  }
  const channel = body.channel === "EMAIL" ? "EMAIL" : "SMS";
  const message = String(body.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });

  // Emergency override requires a reason (audit trail). Only meaningful for SMS,
  // which is the only channel the quiet-hours guard applies to.
  const emergency = Boolean(body.emergency) && channel === "SMS";
  const emergencyReason = String(body.emergencyReason ?? "").trim();
  if (emergency && !emergencyReason) {
    return NextResponse.json(
      { error: "Add a short reason for the emergency send (kept on the timeline)." },
      { status: 400 },
    );
  }

  const result = await runReactivation({
    orgId: session.orgId,
    segment: body.segment as ReactivationSegment,
    channel,
    subject: body.subject ?? null,
    message,
    emergency,
    emergencyReason: emergency ? emergencyReason : null,
  });
  if (result.blocked) {
    return NextResponse.json({ error: result.blocked }, { status: 400 });
  }
  return NextResponse.json(result);
}
