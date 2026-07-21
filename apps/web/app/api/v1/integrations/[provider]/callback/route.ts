import { NextResponse } from "next/server";
import {
  connectOAuthTokens,
  exchangeOAuthCode,
  getProviderMeta,
  verifyOAuthState,
} from "@guestflow/core";

type Ctx = { params: { provider: string } };

export async function GET(req: Request, { params }: Ctx) {
  const provider = params.provider.toLowerCase();
  const meta = getProviderMeta(provider);
  const appUrl = process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

  if (!meta || meta.auth !== "oauth") {
    return NextResponse.redirect(`${appUrl}/integrations?error=unknown_provider`);
  }

  const { searchParams } = new URL(req.url);
  const err = searchParams.get("error");
  if (err) {
    return NextResponse.redirect(
      `${appUrl}/integrations?error=${encodeURIComponent(err)}`,
    );
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/integrations?error=missing_code`);
  }

  try {
    const parsed = verifyOAuthState(state);
    if (parsed.provider !== provider) {
      throw new Error("Provider mismatch");
    }
    const tokens = await exchangeOAuthCode(provider, code);
    await connectOAuthTokens({
      orgId: parsed.orgId,
      provider,
      tokens,
    });
    return NextResponse.redirect(
      `${appUrl}/integrations?connected=${encodeURIComponent(provider)}`,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "oauth_failed";
    return NextResponse.redirect(
      `${appUrl}/integrations?error=${encodeURIComponent(message)}`,
    );
  }
}
