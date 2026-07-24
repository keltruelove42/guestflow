import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import {
  dialTwiml,
  emptyTwiml,
  handleMissedCall,
  orgIdForNumber,
  sayHangupTwiml,
} from "@guestflow/core";

export const runtime = "nodejs";

function xml(body: string): NextResponse {
  return new NextResponse(body, { headers: { "Content-Type": "text/xml" } });
}

/**
 * Twilio Voice webhook ("A call comes in"). Point each number's Voice URL at
 * {APP_URL}/api/webhooks/twilio/voice?secret=INBOUND_EMAIL_SECRET.
 *
 * With a forward number set: ring the business first; if unanswered, the Dial
 * action (this same route, ?stage=status) texts the caller back. With no
 * forward number: text back immediately.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.INBOUND_EMAIL_SECRET?.trim();
  if (secret && url.searchParams.get("secret") !== secret) {
    return xml(emptyTwiml());
  }

  const form = await req.formData().catch(() => null);
  if (!form) return xml(emptyTwiml());
  const from = String(form.get("From") ?? "");
  const to = String(form.get("To") ?? "");
  const stage = url.searchParams.get("stage");

  const orgId = url.searchParams.get("org") || (await orgIdForNumber(to));
  if (!orgId) return xml(emptyTwiml());

  // Stage 2: the Dial finished. Text back unless the call was answered.
  if (stage === "status") {
    const dialStatus = String(form.get("DialCallStatus") ?? "");
    if (dialStatus && dialStatus !== "completed") {
      await handleMissedCall({ orgId, from });
      return xml(sayHangupTwiml("Sorry we missed you — we just texted you. Talk soon!"));
    }
    return xml(emptyTwiml());
  }

  // Stage 1: incoming call.
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { missedCallEnabled: true, voiceForwardPhone: true },
  });
  if (!org?.missedCallEnabled) return xml(emptyTwiml());

  const forward = org.voiceForwardPhone?.trim();
  if (forward) {
    const action = `${url.origin}/api/webhooks/twilio/voice?stage=status&org=${orgId}${
      secret ? `&secret=${encodeURIComponent(secret)}` : ""
    }`;
    return xml(dialTwiml({ forwardNumber: forward, actionUrl: action }));
  }

  // No forward number — text back right away.
  await handleMissedCall({ orgId, from });
  return xml(sayHangupTwiml("Thanks for calling — we just sent you a text. Talk soon!"));
}
