import { NextResponse } from "next/server";
import {
  buildOAuthUrl,
  connectWithCredentials,
  getProviderMeta,
  oauthConfigured,
  signOAuthState,
} from "@guestflow/core";
import { getSession } from "@/lib/auth";

type Ctx = { params: { provider: string } };

export async function POST(req: Request, { params }: Ctx) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const provider = params.provider.toLowerCase();
  const meta = getProviderMeta(provider);
  if (!meta) return NextResponse.json({ error: "Unknown provider" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    const wantsOAuth = meta.auth === "oauth" || (meta.oauthOption && body.mode === "oauth");
    if (wantsOAuth) {
      if (!oauthConfigured(provider)) {
        return NextResponse.json(
          {
            error: meta.setupHint ?? "OAuth is not configured for this provider",
            code: "OAUTH_NOT_CONFIGURED",
          },
          { status: 400 },
        );
      }
      const state = signOAuthState({
        orgId: session.orgId,
        provider,
        userId: session.sub,
      });
      const { url } = buildOAuthUrl(provider, state);
      return NextResponse.json({ oauthUrl: url });
    }

    const credentials: Record<string, unknown> = {};
    for (const field of meta.fields) {
      if (body[field.key] != null) credentials[field.key] = body[field.key];
    }

    const integration = await connectWithCredentials({
      orgId: session.orgId,
      provider,
      credentials,
      config:
        body.config && typeof body.config === "object"
          ? (body.config as Record<string, unknown>)
          : null,
    });

    return NextResponse.json({
      id: integration.id,
      provider: integration.provider,
      status: integration.status,
      lastSyncAt: integration.lastSyncAt,
      lastError: integration.lastError,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connect failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
