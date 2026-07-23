import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import {
  isRewriteConfigured,
  rewriteTemplate,
  sanitizeVariables,
  MERGE_TAGS,
} from "@guestflow/core";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/v1/ai/rewrite — "Rewrite with AI" for sequence templates.
 * Text only. Pulls business context the app already collects (vertical,
 * org variables, brand business name) + the template being edited.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isRewriteConfigured()) {
    return NextResponse.json(
      { error: "AI rewrite is not configured yet — add ANTHROPIC_API_KEY to enable it." },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    channel?: "EMAIL" | "SMS" | "CALL";
    subject?: string | null;
    body?: string;
    instruction?: string | null;
    sequenceId?: string | null;
  } | null;

  if (!body || typeof body.body !== "string" || !body.body.trim()) {
    return NextResponse.json({ error: "Template body is required" }, { status: 400 });
  }
  if (body.body.length > 8000 || (body.subject?.length ?? 0) > 500) {
    return NextResponse.json({ error: "Template too long" }, { status: 400 });
  }
  const channel =
    body.channel === "SMS" || body.channel === "CALL" ? body.channel : "EMAIL";

  const org = await prisma.org.findUniqueOrThrow({
    where: { id: session.orgId },
    select: { vertical: true, variables: true, brandSettings: { select: { businessName: true } } },
  });

  const sequence = body.sequenceId
    ? await prisma.sequence.findFirst({
        where: { id: body.sequenceId, orgId: session.orgId },
        select: { name: true, trigger: true },
      })
    : null;

  const variables = sanitizeVariables(org.variables);
  const knownTags = [
    ...MERGE_TAGS,
    ...Object.keys(variables).filter((k) => !(MERGE_TAGS as readonly string[]).includes(k)),
  ];

  try {
    const result = await rewriteTemplate({
      channel,
      subject: body.subject ?? null,
      body: body.body,
      instruction: body.instruction?.slice(0, 500) ?? null,
      business: {
        vertical: org.vertical,
        businessName: org.brandSettings?.businessName ?? variables.business_name ?? null,
        variables,
        knownTags,
      },
      sequence,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI rewrite failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
