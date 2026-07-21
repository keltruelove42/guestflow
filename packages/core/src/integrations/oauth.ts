import { createHmac, timingSafeEqual } from "crypto";
import { getProviderMeta } from "./catalog";

const APP_URL = () => process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

function oauthStateSecret(): string {
  return (
    process.env.CREDENTIALS_KEY?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "dev-oauth-state"
  );
}

export function signOAuthState(payload: {
  orgId: string;
  provider: string;
  userId: string;
}): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + 15 * 60_000 }),
    "utf8",
  ).toString("base64url");
  const sig = createHmac("sha256", oauthStateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyOAuthState(state: string): {
  orgId: string;
  provider: string;
  userId: string;
} {
  const [body, sig] = state.split(".");
  if (!body || !sig) throw new Error("Invalid OAuth state");
  const expected = createHmac("sha256", oauthStateSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Invalid OAuth state signature");
  }
  const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
    orgId: string;
    provider: string;
    userId: string;
    exp: number;
  };
  if (parsed.exp < Date.now()) throw new Error("OAuth state expired");
  return parsed;
}

export function oauthConfigured(provider: string): boolean {
  switch (provider) {
    case "meta":
      return Boolean(process.env.META_APP_ID?.trim() && process.env.META_APP_SECRET?.trim());
    case "tiktok":
      return Boolean(process.env.TIKTOK_APP_ID?.trim() && process.env.TIKTOK_APP_SECRET?.trim());
    case "pinterest":
      return Boolean(
        process.env.PINTEREST_APP_ID?.trim() && process.env.PINTEREST_APP_SECRET?.trim(),
      );
    case "stripe":
      return Boolean(process.env.STRIPE_CLIENT_ID?.trim() && process.env.STRIPE_SECRET_KEY?.trim());
    case "hostfully":
      return Boolean(
        process.env.HOSTFULLY_CLIENT_ID?.trim() && process.env.HOSTFULLY_CLIENT_SECRET?.trim(),
      );
    default:
      return false;
  }
}

export function buildOAuthUrl(
  provider: string,
  state: string,
): { url: string } {
  const meta = getProviderMeta(provider);
  if (!meta || (meta.auth !== "oauth" && !meta.oauthOption)) {
    throw new Error("Not an OAuth provider");
  }
  if (!oauthConfigured(provider)) {
    throw new Error(meta.setupHint ?? `${provider} OAuth is not configured`);
  }

  const redirectUri = `${APP_URL()}/api/v1/integrations/${provider}/callback`;

  if (provider === "meta") {
    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID!.trim(),
      redirect_uri: redirectUri,
      state,
      response_type: "code",
      scope: [
        "ads_management",
        "leads_retrieval",
        "pages_manage_ads",
        "pages_show_list",
        "pages_read_engagement",
        "business_management",
      ].join(","),
    });
    return {
      url: `https://www.facebook.com/v21.0/dialog/oauth?${params}`,
    };
  }

  if (provider === "tiktok") {
    const params = new URLSearchParams({
      app_id: process.env.TIKTOK_APP_ID!.trim(),
      redirect_uri: redirectUri,
      state,
      rid: randomRid(),
    });
    return {
      url: `https://business-api.tiktok.com/portal/auth?${params}`,
    };
  }

  if (provider === "pinterest") {
    const params = new URLSearchParams({
      client_id: process.env.PINTEREST_APP_ID!.trim(),
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "ads:read,ads:write,user_accounts:read",
      state,
    });
    return {
      url: `https://www.pinterest.com/oauth/?${params}`,
    };
  }

  if (provider === "stripe") {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.STRIPE_CLIENT_ID!.trim(),
      scope: "read_write",
      redirect_uri: redirectUri,
      state,
    });
    return {
      url: `https://connect.stripe.com/oauth/authorize?${params}`,
    };
  }

  if (provider === "hostfully") {
    // docs: dev.hostfully.com/reference/authorizing-integration-as-a-customer
    const params = new URLSearchParams({
      clientId: process.env.HOSTFULLY_CLIENT_ID!.trim(),
      redirectUri,
      scope: "FULL",
      grantType: "REFRESH_TOKEN",
      state,
    });
    return {
      url: `${HOSTFULLY_OAUTH_BASE()}/api/auth/oauth/authorize?${params}`,
    };
  }

  throw new Error(`OAuth not implemented for ${provider}`);
}


const HOSTFULLY_OAUTH_BASE = () =>
  process.env.HOSTFULLY_OAUTH_BASE?.replace(/\/$/, "") || "https://platform.hostfully.com";

function randomRid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function exchangeOAuthCode(
  provider: string,
  code: string,
): Promise<Record<string, unknown>> {
  const redirectUri = `${APP_URL()}/api/v1/integrations/${provider}/callback`;

  if (provider === "meta") {
    const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", process.env.META_APP_ID!.trim());
    tokenUrl.searchParams.set("client_secret", process.env.META_APP_SECRET!.trim());
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);
    const res = await fetch(tokenUrl);
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(String(data.error_message ?? data.error ?? "Meta token exchange failed"));
    }
    // Exchange for long-lived token
    const ll = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    ll.searchParams.set("grant_type", "fb_exchange_token");
    ll.searchParams.set("client_id", process.env.META_APP_ID!.trim());
    ll.searchParams.set("client_secret", process.env.META_APP_SECRET!.trim());
    ll.searchParams.set("fb_exchange_token", String(data.access_token));
    const llRes = await fetch(ll);
    const llData = (await llRes.json()) as Record<string, unknown>;
    const accessToken = String(llData.access_token ?? data.access_token);
    const me = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${accessToken}`,
    );
    const profile = (await me.json()) as Record<string, unknown>;
    return {
      accessToken,
      tokenType: "bearer",
      expiresIn: llData.expires_in ?? data.expires_in,
      userId: profile.id,
      userName: profile.name,
    };
  }

  if (provider === "tiktok") {
    const res = await fetch(
      "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_id: process.env.TIKTOK_APP_ID!.trim(),
          secret: process.env.TIKTOK_APP_SECRET!.trim(),
          auth_code: code,
        }),
      },
    );
    const data = (await res.json()) as {
      code?: number;
      message?: string;
      data?: Record<string, unknown>;
    };
    if (!res.ok || data.code !== 0 || !data.data) {
      throw new Error(data.message ?? "TikTok token exchange failed");
    }
    return {
      accessToken: data.data.access_token,
      refreshToken: data.data.refresh_token,
      advertiserIds: data.data.advertiser_ids,
    };
  }

  if (provider === "pinterest") {
    const basic = Buffer.from(
      `${process.env.PINTEREST_APP_ID!.trim()}:${process.env.PINTEREST_APP_SECRET!.trim()}`,
    ).toString("base64");
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    });
    const res = await fetch("https://api.pinterest.com/v5/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) throw new Error(String(data.message ?? "Pinterest token exchange failed"));
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      scope: data.scope,
    };
  }

  if (provider === "stripe") {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_secret: process.env.STRIPE_SECRET_KEY!.trim(),
    });
    const res = await fetch("https://connect.stripe.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) throw new Error(String(data.error_description ?? "Stripe OAuth failed"));
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      stripeUserId: data.stripe_user_id,
      publishableKey: data.stripe_publishable_key,
    };
  }

  if (provider === "hostfully") {
    const data = await hostfullyTokenRequest("code-exchange", {
      code,
      redirectUri,
      scope: "FULL",
      grantType: "REFRESH_TOKEN",
    });
    return { oauth: true, ...data };
  }

  throw new Error(`OAuth exchange not implemented for ${provider}`);
}

/** Shared Basic-auth POST for Hostfully's OAuth token endpoints. */
async function hostfullyTokenRequest(
  path: "code-exchange" | "token-refresh",
  payload: Record<string, unknown>,
): Promise<{ accessToken: string; refreshToken: string; obtainedAt: string }> {
  const basic = Buffer.from(
    `${process.env.HOSTFULLY_CLIENT_ID!.trim()}:${process.env.HOSTFULLY_CLIENT_SECRET!.trim()}`,
    "utf8",
  ).toString("base64");
  const res = await fetch(`${HOSTFULLY_OAUTH_BASE()}/api/auth/oauth/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const accessToken = String(data.accessToken ?? data.access_token ?? "");
  const refreshToken = String(data.refreshToken ?? data.refresh_token ?? "");
  if (!res.ok || !accessToken || !refreshToken) {
    const detail =
      (typeof data.message === "string" && data.message) ||
      (typeof data.error === "string" && data.error) ||
      `HTTP ${res.status}`;
    throw new Error(`Hostfully ${path} failed: ${detail}`);
  }
  return { accessToken, refreshToken, obtainedAt: new Date().toISOString() };
}

/**
 * Refresh a Hostfully OAuth token pair. IMPORTANT: Hostfully rotates the
 * refresh token on every call — the caller MUST persist the returned pair
 * immediately or the grant is lost.
 */
export async function refreshHostfullyTokens(refreshToken: string) {
  return hostfullyTokenRequest("token-refresh", { refreshToken });
}
