import { NextResponse } from "next/server";
import { analyticsCatalog } from "@guestflow/core";
import { requireGrowth } from "@/lib/growth";

/** GET /api/v1/analytics/catalog — metrics/dimensions the builder can use. */
export async function GET() {
  const gate = await requireGrowth();
  if (!gate.ok) return gate.response;
  return NextResponse.json(analyticsCatalog());
}
