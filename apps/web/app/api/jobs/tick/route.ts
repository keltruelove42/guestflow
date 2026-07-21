import { NextResponse } from "next/server";
import { tick } from "@guestflow/core";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const session = await getSession();

  const cronOk = secret && auth === `Bearer ${secret}`;
  if (!cronOk && !session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await tick({
    orgId: session?.orgId,
  });
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  return GET(req);
}
