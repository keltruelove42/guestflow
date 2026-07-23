import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { z } from "zod";
import { prisma } from "@guestflow/db";
import {
  resolveApiKey,
  importLeads,
  sendManualMessage,
  manualEnroll,
  checkAvailability,
  bookAppointment,
  getBusinessContext,
} from "@guestflow/core";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * LeadCoda MCP server — exposes a business's CRM as tools any MCP client
 * (Claude, ChatGPT, an agent) can call. Auth: `Authorization: Bearer lc_live_…`
 * (an org API key from Settings → API & MCP). Every tool is org-scoped to that
 * key. Same capability layer the in-app reply agent uses — one surface for
 * humans, one for the owner's assistant, and the foundation for agent-to-agent.
 */

const handler = createMcpHandler(
  (server) => {
    // ── Read: pipeline ────────────────────────────────────────────────────
    server.tool(
      "search_leads",
      "Search this business's leads. Filter by stage, source, or a text query on name/email/phone.",
      {
        query: z.string().optional().describe("Match name, email, or phone"),
        stage: z
          .enum(["NEW", "CONTACTED", "ENGAGED", "QUOTED", "BOOKED", "LOST"])
          .optional(),
        limit: z.number().min(1).max(50).optional(),
      },
      async ({ query, stage, limit }, extra) => {
        const orgId = extra.authInfo?.extra?.orgId as string;
        const leads = await prisma.lead.findMany({
          where: {
            orgId,
            isDemo: false,
            ...(stage ? { stage } : {}),
            ...(query
              ? {
                  OR: [
                    { name: { contains: query, mode: "insensitive" } },
                    { email: { contains: query, mode: "insensitive" } },
                    { phone: { contains: query } },
                  ],
                }
              : {}),
          },
          orderBy: { createdAt: "desc" },
          take: limit ?? 20,
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            stage: true,
            source: true,
            createdAt: true,
          },
        });
        return { content: [{ type: "text", text: JSON.stringify(leads, null, 2) }] };
      },
    );

    server.tool(
      "get_lead",
      "Get one lead's full detail plus its recent activity timeline.",
      { leadId: z.string() },
      async ({ leadId }, extra) => {
        const orgId = extra.authInfo?.extra?.orgId as string;
        const lead = await prisma.lead.findFirst({
          where: { id: leadId, orgId },
          include: {
            property: { select: { name: true } },
            events: { orderBy: { occurredAt: "desc" }, take: 20 },
          },
        });
        if (!lead) return { content: [{ type: "text", text: "Lead not found." }] };
        return { content: [{ type: "text", text: JSON.stringify(lead, null, 2) }] };
      },
    );

    server.tool(
      "pipeline_summary",
      "Counts of leads by stage, plus totals — a quick pipeline snapshot.",
      {},
      async (_args, extra) => {
        const orgId = extra.authInfo?.extra?.orgId as string;
        const grouped = await prisma.lead.groupBy({
          by: ["stage"],
          where: { orgId, isDemo: false },
          _count: { _all: true },
        });
        const byStage = Object.fromEntries(grouped.map((g) => [g.stage, g._count._all]));
        const total = grouped.reduce((s, g) => s + g._count._all, 0);
        return {
          content: [{ type: "text", text: JSON.stringify({ total, byStage }, null, 2) }],
        };
      },
    );

    // ── Write: leads & outreach ───────────────────────────────────────────
    server.tool(
      "create_lead",
      "Add a lead by hand. Requires a name and at least one of email or phone.",
      {
        name: z.string(),
        email: z.string().optional(),
        phone: z.string().optional(),
        notes: z.string().optional(),
        emailConsent: z.boolean().optional(),
        smsConsent: z.boolean().optional(),
      },
      async (args, extra) => {
        const orgId = extra.authInfo?.extra?.orgId as string;
        if (!args.email && !args.phone) {
          return { content: [{ type: "text", text: "Provide an email or phone." }] };
        }
        const r = await importLeads({
          orgId,
          source: "MANUAL",
          sourceTitle: "Added via API",
          emailConsent: Boolean(args.emailConsent),
          smsConsent: Boolean(args.smsConsent),
          rows: [{ name: args.name, email: args.email, phone: args.phone, notes: args.notes }],
        });
        return {
          content: [
            {
              type: "text",
              text: r.leadIds[0]
                ? `Lead saved (id ${r.leadIds[0]}${r.merged ? ", merged with an existing lead" : ""}).`
                : r.errors[0]?.reason ?? "Could not create lead.",
            },
          ],
        };
      },
    );

    server.tool(
      "send_message",
      "Send an email or SMS to a lead now. Respects consent, quiet hours, and sending limits.",
      {
        leadId: z.string(),
        channel: z.enum(["EMAIL", "SMS"]),
        body: z.string(),
      },
      async ({ leadId, channel, body }, extra) => {
        const orgId = extra.authInfo?.extra?.orgId as string;
        try {
          await sendManualMessage({ orgId, leadId, channel, body });
          return { content: [{ type: "text", text: "Sent." }] };
        } catch (e) {
          return {
            content: [{ type: "text", text: `Not sent: ${e instanceof Error ? e.message : "failed"}` }],
          };
        }
      },
    );

    server.tool(
      "enroll_lead_in_sequence",
      "Enroll a lead into a follow-up sequence.",
      { leadId: z.string(), sequenceId: z.string() },
      async ({ leadId, sequenceId }, extra) => {
        const orgId = extra.authInfo?.extra?.orgId as string;
        const lead = await prisma.lead.findFirst({ where: { id: leadId, orgId }, select: { id: true } });
        if (!lead) return { content: [{ type: "text", text: "Lead not found." }] };
        const r = await manualEnroll(leadId, sequenceId);
        return {
          content: [{ type: "text", text: r.enrolled ? "Enrolled." : `Not enrolled: ${r.reason}` }],
        };
      },
    );

    server.tool(
      "list_sequences",
      "List this business's follow-up sequences (id, name, active).",
      {},
      async (_args, extra) => {
        const orgId = extra.authInfo?.extra?.orgId as string;
        const seqs = await prisma.sequence.findMany({
          where: { orgId },
          select: { id: true, name: true, active: true, trigger: true },
          orderBy: { createdAt: "asc" },
        });
        return { content: [{ type: "text", text: JSON.stringify(seqs, null, 2) }] };
      },
    );

    // ── Booking (the A2A core) ────────────────────────────────────────────
    server.tool(
      "check_availability",
      "List open appointment slots for this business over the next N days.",
      { days: z.number().min(1).max(30).optional() },
      async ({ days }, extra) => {
        const orgId = extra.authInfo?.extra?.orgId as string;
        const r = await checkAvailability(orgId, { days: days ?? 10 });
        return {
          content: [
            {
              type: "text",
              text: r.enabled
                ? JSON.stringify(r.slots, null, 2)
                : "Online booking is off for this business.",
            },
          ],
        };
      },
    );

    server.tool(
      "book_appointment",
      "Book an appointment for a lead at an exact slot start time from check_availability.",
      { leadId: z.string(), startISO: z.string() },
      async ({ leadId, startISO }, extra) => {
        const orgId = extra.authInfo?.extra?.orgId as string;
        const r = await bookAppointment(orgId, leadId, { startISO, source: "mcp" });
        return {
          content: [{ type: "text", text: r.ok ? `Booked for ${r.label}.` : `Not booked: ${r.reason}` }],
        };
      },
    );

    server.tool(
      "get_business_info",
      "The business's own details: name, industry, services/pricing/policies, and booking types.",
      {},
      async (_args, extra) => {
        const orgId = extra.authInfo?.extra?.orgId as string;
        const ctx = await getBusinessContext(orgId);
        return { content: [{ type: "text", text: JSON.stringify(ctx, null, 2) }] };
      },
    );
  },
  {},
  { basePath: "/api" },
);

/** Verify the bearer API key and hand orgId to the tools via authInfo.extra. */
async function verifyToken(
  _req: Request,
  bearer?: string,
): Promise<AuthInfo | undefined> {
  const ctx = await resolveApiKey(bearer);
  if (!ctx) return undefined;
  return {
    token: bearer ?? "",
    clientId: ctx.orgId,
    scopes: [],
    extra: { orgId: ctx.orgId },
  };
}

const authed = withMcpAuth(handler, verifyToken, { required: true });

export { authed as GET, authed as POST, authed as DELETE };
