import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@guestflow/db";
import {
  buildImagePrompt,
  canGenerateImages,
  generateImage,
  isImageGenConfigured,
  sanitizeVariables,
} from "@guestflow/core";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/v1/ai/generate-image — Growth/Enterprise only.
 * { sequenceId, instruction? } → Claude crafts an on-brand prompt from
 * brand_settings + template/business context → image provider renders it →
 * stored in Vercel Blob + generated_images row → attached to the sequence's
 * heroPhotoUrl slot (same slot Phase 1 built for manual uploads).
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await prisma.org.findUniqueOrThrow({
    where: { id: session.orgId },
    select: {
      plan: true,
      vertical: true,
      variables: true,
      brandSettings: true,
    },
  });

  // Feature flag on plan tier — checked before anything else.
  if (!canGenerateImages(org.plan)) {
    return NextResponse.json(
      { error: "AI image generation is included with the Growth plan. Upgrade to enable it." },
      { status: 403 },
    );
  }

  if (!isImageGenConfigured()) {
    return NextResponse.json(
      { error: "Image generation is not configured yet — add OPENAI_API_KEY and ANTHROPIC_API_KEY to enable it." },
      { status: 503 },
    );
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Image storage is not configured yet — add a Vercel Blob store (BLOB_READ_WRITE_TOKEN)." },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    sequenceId?: string;
    instruction?: string | null;
  } | null;
  if (!body?.sequenceId) {
    return NextResponse.json({ error: "sequenceId is required" }, { status: 400 });
  }

  const sequence = await prisma.sequence.findFirst({
    where: { id: body.sequenceId, orgId: session.orgId },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  if (!sequence) return NextResponse.json({ error: "Sequence not found" }, { status: 404 });

  const firstEmail = sequence.steps.find((s) => s.channel === "EMAIL");
  const variables = sanitizeVariables(org.variables);

  try {
    const prompt = await buildImagePrompt({
      vertical: org.vertical,
      businessName: org.brandSettings?.businessName ?? variables.business_name ?? null,
      primaryColor: org.brandSettings?.primaryColor,
      accentColor: org.brandSettings?.accentColor,
      variables,
      sequence: { name: sequence.name, trigger: sequence.trigger },
      emailSubject: firstEmail?.subject,
      emailBody: firstEmail?.body,
      instruction: body.instruction?.slice(0, 300) ?? null,
    });

    const bytes = await generateImage(prompt);

    const blob = await put(
      `heroes/${session.orgId}/generated-${Date.now()}.png`,
      Buffer.from(bytes),
      { access: "public", contentType: "image/png" },
    );

    const record = await prisma.generatedImage.create({
      data: {
        orgId: session.orgId,
        sequenceId: sequence.id,
        prompt,
        imageUrl: blob.url,
      },
    });

    // Attach to the same hero slot Phase 1 built — no new rendering path.
    await prisma.sequence.update({
      where: { id: sequence.id },
      data: { heroPhotoUrl: blob.url },
    });

    return NextResponse.json({ url: blob.url, prompt, id: record.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Image generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
