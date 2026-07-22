import { decryptJson, isEncryptedBlob } from "../crypto/credentials";
import { parseTwilioCredentials } from "./twilio";

export function readIntegrationCredentials<T = Record<string, unknown>>(
  credentials: unknown,
): T | null {
  if (!credentials) return null;
  try {
    return decryptJson<T>(credentials);
  } catch {
    if (credentials && typeof credentials === "object" && !isEncryptedBlob(credentials)) {
      return credentials as T;
    }
    return null;
  }
}

export async function verifyProviderCredentials(
  provider: string,
  creds: Record<string, unknown>,
): Promise<{ ok: true; detail?: string } | { ok: false; error: string }> {
  try {
    if (provider === "twilio") {
      const parsed = parseTwilioCredentials(creds);
      if (!parsed) return { ok: false, error: "Missing SID, auth token, or from number" };
      if (!/^\+\d{8,15}$/.test(parsed.fromNumber)) {
        return {
          ok: false,
          error: "From number must be in +1XXXXXXXXXX format (your Twilio number)",
        };
      }
      const { resolveTwilioAuth } = await import("./twilio");
      let auth;
      try {
        auth = await resolveTwilioAuth(parsed);
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : "Twilio rejected these credentials",
        };
      }
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${auth.accountSid}.json`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString("base64")}`,
          },
        },
      );
      if (!res.ok) {
        return {
          ok: false,
          error:
            "Twilio rejected these credentials. Use your Account SID (AC...) + Auth Token, or an API Key SID (SK...) + its secret",
        };
      }
      return { ok: true, detail: "Twilio account verified" };
    }

    if (provider === "hostfully") {
      const apiKey = String(creds.apiKey ?? "").trim();
      if (!apiKey) return { ok: false, error: "API key required" };
      const res = await fetch("https://api.hostfully.com/api/properties", {
        headers: {
          "X-HOSTFULLY-APIKEY": apiKey,
          Accept: "application/json",
        },
      });
      // Some accounts use v2 — try v2 agencies if v1 fails auth-ish
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: "Hostfully rejected this API key" };
      }
      if (!res.ok && res.status !== 404) {
        const v2 = await fetch("https://api.hostfully.com/v2/properties?limit=1", {
          headers: {
            "X-HOSTFULLY-APIKEY": apiKey,
            Accept: "application/json",
          },
        });
        if (v2.status === 401 || v2.status === 403) {
          return { ok: false, error: "Hostfully rejected this API key" };
        }
        if (!v2.ok) {
          return {
            ok: false,
            error: `Hostfully returned ${v2.status}. Check key and agency access.`,
          };
        }
      }
      return { ok: true, detail: "Hostfully API key accepted" };
    }

    if (provider === "hostaway") {
      const accountId = String(creds.accountId ?? "").trim();
      const clientSecret = String(creds.clientSecret ?? "").trim();
      if (!accountId || !clientSecret) {
        return { ok: false, error: "Account ID and client secret required" };
      }
      const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: accountId,
        client_secret: clientSecret,
        scope: "general",
      });
      const res = await fetch("https://api.hostaway.com/v1/accessTokens", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const data = (await res.json().catch(() => ({}))) as {
        access_token?: string;
        message?: string;
      };
      if (!res.ok || !data.access_token) {
        return { ok: false, error: data.message ?? "Hostaway auth failed" };
      }
      return { ok: true, detail: "Hostaway token issued" };
    }

    if (provider === "klaviyo") {
      const apiKey = String(creds.apiKey ?? "").trim();
      if (!apiKey) return { ok: false, error: "API key required" };
      if (!apiKey.startsWith("pk_")) {
        return {
          ok: false,
          error:
            "That looks like a public key. Klaviyo private API keys start with pk_ (Settings → API keys → Create Private API Key)",
        };
      }
      const res = await fetch("https://a.klaviyo.com/api/accounts/", {
        headers: {
          Authorization: `Klaviyo-API-Key ${apiKey}`,
          Accept: "application/json",
          revision: "2024-10-15",
        },
      });
      if (res.ok) return { ok: true, detail: "Klaviyo key verified" };

      // 403 = the key is real but missing the accounts:read scope —
      // still a usable key for lists/events, so accept it.
      if (res.status === 403) {
        return { ok: true, detail: "Klaviyo key accepted (limited scopes)" };
      }

      const body = (await res.json().catch(() => null)) as {
        errors?: Array<{ detail?: string; title?: string }>;
      } | null;
      const detail = body?.errors?.[0]?.detail ?? body?.errors?.[0]?.title;
      return {
        ok: false,
        error: detail
          ? `Klaviyo: ${detail}`
          : `Klaviyo rejected this API key (HTTP ${res.status}). Check it was copied fully and is a Private API Key`,
      };
    }

    if (provider === "resend") {
      const apiKey = String(creds.apiKey ?? "").trim();
      if (!apiKey) return { ok: false, error: "API key required" };
      if (!apiKey.startsWith("re_")) {
        return {
          ok: false,
          error: "Resend API keys start with re_ (resend.com → API Keys)",
        };
      }
      const fromEmail = String(creds.fromEmail ?? "").trim();
      if (fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
        return { ok: false, error: "From address does not look like an email" };
      }
      const res = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.status === 401) {
        return { ok: false, error: "Resend rejected this API key" };
      }
      // 403 = sending-only key (cannot list domains) - still valid for sends
      if (!res.ok && res.status !== 403) {
        return { ok: false, error: `Resend returned ${res.status}. Check the key` };
      }
      if (fromEmail && res.ok) {
        const data = (await res.json().catch(() => null)) as {
          data?: Array<{ name?: string; status?: string }>;
        } | null;
        const domain = fromEmail.split("@")[1]?.toLowerCase();
        const verified = data?.data?.some(
          (d) => d.name?.toLowerCase() === domain && d.status === "verified",
        );
        if (data?.data && !verified) {
          return {
            ok: false,
            error: `The domain ${domain} is not verified in Resend yet. Verify it there first, or leave the from address blank to use Resend's test sender`,
          };
        }
      }
      return { ok: true, detail: "Resend key verified" };
    }

    if (provider === "lodgify") {
      const apiKey = String(creds.apiKey ?? "").trim();
      if (!apiKey) return { ok: false, error: "API key required" };
      const res = await fetch("https://api.lodgify.com/v2/properties", {
        headers: { "X-ApiKey": apiKey, Accept: "application/json" },
      });
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: "Lodgify rejected this API key" };
      }
      // 200 or other non-auth errors still mean key shape may be ok
      if (!res.ok && res.status >= 500) {
        return { ok: false, error: `Lodgify error ${res.status}` };
      }
      return { ok: true, detail: "Lodgify key accepted" };
    }

    if (provider === "ownerrez") {
      const apiKey = String(creds.apiKey ?? "").trim();
      const userId = String(creds.userId ?? "").trim();
      if (!apiKey || !userId) return { ok: false, error: "Email and API token required" };
      const res = await fetch("https://api.ownerrez.com/v2/properties?limit=1", {
        headers: {
          Authorization: `Basic ${Buffer.from(`${userId}:${apiKey}`).toString("base64")}`,
          Accept: "application/json",
        },
      });
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: "OwnerRez rejected these credentials" };
      }
      return { ok: true, detail: "OwnerRez credentials accepted" };
    }

    if (provider === "stayfi") {
      const apiKey = String(creds.apiKey ?? "").trim();
      if (!apiKey) return { ok: false, error: "API key required" };
      // StayFi endpoints vary by plan — accept key format and store; sync validates later
      if (apiKey.length < 8) return { ok: false, error: "API key looks too short" };
      return { ok: true, detail: "StayFi key saved (sync when endpoint available)" };
    }

    // OAuth tokens already verified during exchange
    if (creds.accessToken) return { ok: true, detail: "OAuth token stored" };

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Verification failed",
    };
  }
}
