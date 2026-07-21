import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";

/** One-click email unsubscribe — compliance required. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get("leadId");
  if (!leadId) {
    return new NextResponse("Missing leadId", { status: 400 });
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    return new NextResponse("Already unsubscribed or unknown.", { status: 200 });
  }

  if (!lead.unsubscribedAt) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { unsubscribedAt: new Date(), emailConsent: false },
    });
    await prisma.leadEvent.create({
      data: {
        orgId: lead.orgId,
        leadId,
        type: "OPTED_OUT",
        channel: "EMAIL",
        title: "Email unsubscribed",
      },
    });
  }

  return new NextResponse(
    `<!doctype html><html><body style="font-family:system-ui;padding:2rem">
      <h1>You're unsubscribed</h1>
      <p>You won't receive further marketing emails from this host.</p>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } },
  );
}
