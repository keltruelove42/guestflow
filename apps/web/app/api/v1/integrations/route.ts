import { NextResponse } from "next/server";
import { prisma } from "@guestflow/db";
import { PROVIDER_CATALOG, oauthConfigured } from "@guestflow/core";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [rows, org] = await Promise.all([
    prisma.integration.findMany({ where: { orgId: session.orgId } }),
    prisma.org.findUniqueOrThrow({
      where: { id: session.orgId },
      select: { vertical: true },
    }),
  ]);
  const byProvider = new Map(rows.map((r) => [r.provider, r]));

  const visible = PROVIDER_CATALOG.filter(
    (c) => !c.verticals || c.verticals.includes(org.vertical),
  );

  return NextResponse.json(
    visible.map((c) => {
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
        oauthOption: c.oauthOption ?? false,
        comingSoon: c.comingSoon ?? false,
        oauthReady:
          c.auth === "oauth" || c.oauthOption ? oauthConfigured(c.provider) : true,
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
