import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { getSession } from "@/lib/auth";

const DEFAULT_MESSAGE =
  "Thanks for choosing {{business_name}}, {{first_name}}! A quick review means the world to a small business — it takes 20 seconds: {{review_link}}";

/** GET/PUT /api/v1/org/review — review-flywheel settings. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await prisma.org.findUniqueOrThrow({
    where: { id: session.orgId },
    select: { reviewEnabled: true, reviewUrl: true, reviewMessage: true },
  });
  return NextResponse.json({
    enabled: org.reviewEnabled,
    url: org.reviewUrl,
    message: org.reviewMessage,
    defaultMessage: DEFAULT_MESSAGE,
  });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    enabled?: boolean;
    url?: string | null;
    message?: string | null;
  };
  const data: Record<string, unknown> = {};
  if (body.enabled !== undefined) data.reviewEnabled = Boolean(body.enabled);
  if (body.url !== undefined) {
    const v = String(body.url ?? "").trim();
    if (v && !/^https?:\/\//.test(v)) {
      return NextResponse.json({ error: "Review link must be a URL" }, { status: 400 });
    }
    data.reviewUrl = v || null;
  }
  if (body.message !== undefined) {
    data.reviewMessage = String(body.message ?? "").trim().slice(0, 480) || null;
  }
  await prisma.org.update({ where: { id: session.orgId }, data });
  return NextResponse.json({ ok: true });
}
