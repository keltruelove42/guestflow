import { NextResponse } from "next/server";
import { fetchListingPreview } from "@guestflow/core";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/properties/preview  { url }
 * Fetches a listing/booking page (Airbnb, VRBO, Hostfully, etc.) and returns
 * { title, description, image } pulled from its Open Graph tags.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const url = body && typeof body.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "Paste a listing URL first" }, { status: 400 });
  }

  try {
    const preview = await fetchListingPreview(url);
    return NextResponse.json(preview);
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "That site took too long to respond. You can add the image and description by hand"
        : err instanceof Error
          ? err.message
          : "Could not fetch a preview from that link";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
