import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { PROVIDER_CATALOG, oauthConfigured } from "@guestflow/core";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.integration.findMany({
    where: { orgId: session.orgId },
  });
  const byProvider = new Map(rows.map((r) => [r.provider, r]));

  return NextResponse.json(
    PROVIDER_CATALOG.map((c) => {
      const row = byProvider.get(c.provider);
      return {
        provider: c.provider,
        name: c.name,
        desc: c.desc,
        icon: c.icon,
        bg: c.bg,
        auth: c.auth,
        fields: c.fields,
        syncLive: c.syncLive,
        docsUrl: c.docsUrl ?? null,
        setupHint: c.setupHint ?? null,
        oauthReady: c.auth === "oauth" ? oauthConfigured(c.provider) : true,
        id: row?.id ?? null,
        status: row?.status ?? "DISCONNECTED",
        lastSyncAt: row?.lastSyncAt ?? null,
        lastError: row?.lastError ?? null,
        isDemo: row?.isDemo ?? false,
        hasCredentials: Boolean(row?.credentials) && !row?.isDemo,
      };
    }),
  );
}
