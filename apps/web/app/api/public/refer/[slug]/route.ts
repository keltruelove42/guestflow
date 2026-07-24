import { NextResponse } from "next/server";
import { captureReferral } from "@guestflow/core";

export const runtime = "nodejs";

type Ctx = { params: { slug: string } };

/** POST /api/public/refer/[slug] — public referral capture. */
export async function POST(req: Request, { params }: Ctx) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    phone?: string;
    ref?: string;
    consent?: boolean;
  };
  const r = await captureReferral({
    slug: params.slug,
    name: String(body.name ?? ""),
    email: body.email ?? null,
    phone: body.phone ?? null,
    refLeadId: body.ref ?? null,
    emailConsent: Boolean(body.consent),
    smsConsent: Boolean(body.consent),
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
