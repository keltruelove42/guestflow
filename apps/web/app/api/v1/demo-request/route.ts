import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  company: z.string().max(200).optional(),
});

/**
 * Book-a-demo requests. Logged for now; set NEXT_PUBLIC_BOOK_DEMO_URL to a
 * Calendly/Cal.com link to skip this form entirely, or wire this to Resend
 * to email the founder on every request.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  console.log("[demo-request]", JSON.stringify(parsed.data));

  return NextResponse.json({ ok: true });
}
