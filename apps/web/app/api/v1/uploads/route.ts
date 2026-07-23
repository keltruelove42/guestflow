import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
// SVG intentionally excluded: it can carry scripts, and blobs are public.
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);
const KINDS = new Set(["logo", "hero"]);

/**
 * POST /api/v1/uploads?kind=logo|hero — image upload to Vercel Blob.
 * Used by Brand settings (logo) and sequence templates (hero photo).
 * Multipart form with a single "file" field. Returns { url }.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "File uploads are not configured yet — add a Vercel Blob store (BLOB_READ_WRITE_TOKEN) to enable them.",
      },
      { status: 503 },
    );
  }

  const kind = new URL(req.url).searchParams.get("kind") ?? "logo";
  if (!KINDS.has(kind)) {
    return NextResponse.json({ error: "kind must be logo or hero" }, { status: 400 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Send multipart form data with a 'file' field" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "File must be a PNG, JPEG, GIF, WebP or SVG image" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be 4 MB or smaller" }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  try {
    const blob = await put(`${kind}s/${session.orgId}/${Date.now()}.${ext}`, file, {
      access: "public",
      contentType: file.type,
    });
    return NextResponse.json({ url: blob.url });
  } catch (e) {
    // Surface the real cause instead of a bare 500 — usually a Private Blob
    // store (must be Public) or an invalid/rotated BLOB_READ_WRITE_TOKEN.
    console.error("[uploads] blob put failed", e);
    const detail = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json(
      {
        error:
          "Upload failed. Make sure your Vercel Blob store is set to Public and BLOB_READ_WRITE_TOKEN is set. (" +
          detail +
          ")",
      },
      { status: 502 },
    );
  }
}
