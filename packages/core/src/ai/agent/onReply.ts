import { prisma } from "@guestflow/db";
import { canGenerateImages } from "../imageGen";
import { isAgentConfigured, runReplyAgent } from "./replyAgent";

/**
 * Called after a lead's inbound reply is recorded. Runs the AI agent per the
 * org's mode and either stores a suggestion for a human (SUGGEST) or sends it
 * automatically (AUTOPILOT). Best-effort: never throws into the caller — a
 * failed agent must not break inbound processing.
 *
 * Gating: Growth/Enterprise only (premium AI). Autopilot additionally requires
 * channel consent and passes through the normal send guards (quiet hours,
 * trial caps, verification) via sendManualMessage; anything it can't send
 * falls back to a suggestion so nothing is silently dropped.
 */
export async function handleInboundForAgent(opts: {
  orgId: string;
  leadId: string;
  incomingText: string;
  channel: "EMAIL" | "SMS";
  now?: Date;
}): Promise<void> {
  try {
    const org = await prisma.org.findUnique({
      where: { id: opts.orgId },
      select: { plan: true, aiAgentMode: true },
    });
    if (!org) return;
    const mode = org.aiAgentMode;
    if (mode !== "SUGGEST" && mode !== "AUTOPILOT") return;
    if (!canGenerateImages(org.plan)) return; // Growth/Enterprise gate
    if (!isAgentConfigured()) return;

    const result = await runReplyAgent(opts);

    // Autopilot only when the agent is confident (no handoff) and the lead has
    // consent for the channel; otherwise fall back to a human suggestion.
    const wantAutopilot = mode === "AUTOPILOT" && !result.handoff;

    if (wantAutopilot) {
      const { sendManualMessage } = await import("../../messaging/sendManual");
      try {
        await sendManualMessage({
          orgId: opts.orgId,
          leadId: opts.leadId,
          channel: opts.channel,
          body: result.reply,
          viaAi: true,
          now: opts.now,
        });
        await prisma.aiSuggestion.create({
          data: {
            orgId: opts.orgId,
            leadId: opts.leadId,
            channel: opts.channel,
            draft: result.reply,
            rationale: result.rationale,
            status: "AUTOSENT",
            bookedAppointmentId: result.bookedAppointmentId,
          },
        });
        return;
      } catch {
        // Send blocked (consent/quiet hours/caps) — keep as a pending suggestion.
      }
    }

    await prisma.aiSuggestion.create({
      data: {
        orgId: opts.orgId,
        leadId: opts.leadId,
        channel: opts.channel,
        draft: result.reply,
        rationale: result.handoff ? result.rationale : result.rationale,
        status: "PENDING",
        bookedAppointmentId: result.bookedAppointmentId,
      },
    });
  } catch {
    // Swallow — inbound recording already succeeded; the agent is best-effort.
  }
}
