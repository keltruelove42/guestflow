import { NextResponse } from "next/server";
import { isPlatformAdmin } from "@guestflow/core";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    orgId: user.orgId,
    orgMode: user.org.mode,
    orgName: user.org.name,
    vertical: user.org.vertical,
    isAdmin: isPlatformAdmin(user.email),
  });
}
