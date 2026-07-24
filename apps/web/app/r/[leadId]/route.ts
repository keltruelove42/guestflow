import { NextResponse } from "next/server";
import { recordReviewClick } from "@guestflow/core";

export const runtime = "nodejs";

type Ctx = { params: { leadId: string } };

/** GET /r/[leadId] — tracked review link: logs the click, redirects to the review URL. */
export async function GET(_req: Request, { params }: Ctx) {
  const dest = await recordReviewClick(params.leadId).catch(() => null);
  return NextResponse.redirect(dest ?? "https://www.google.com/", { status: 302 });
}
