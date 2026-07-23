import { SignJWT, jwtVerify } from "jose";

const COOKIE = "gf_session";

// Fail closed: a weak/absent signing key means anyone can forge a session for
// any org. In production we refuse to run without a strong SESSION_SECRET; only
// local dev falls back to a throwaway key.
const DEV_FALLBACK = "guestflow-dev-session-secret-change-me";
function sessionSecret(): string {
  const s = process.env.SESSION_SECRET?.trim();
  if (process.env.NODE_ENV === "production") {
    if (!s || s.length < 32) {
      throw new Error(
        "SESSION_SECRET is required in production and must be at least 32 characters.",
      );
    }
    return s;
  }
  return s && s.length >= 32 ? s : DEV_FALLBACK;
}
const secret = () => new TextEncoder().encode(sessionSecret());

export type SessionPayload = {
  sub: string;
  email: string;
  name: string | null;
  orgId: string;
};

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    email: payload.email,
    name: payload.name,
    orgId: payload.orgId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || typeof payload.orgId !== "string") return null;
    return {
      sub: payload.sub,
      email: String(payload.email ?? ""),
      name: (payload.name as string | null) ?? null,
      orgId: payload.orgId,
    };
  } catch {
    return null;
  }
}

export { COOKIE as SESSION_COOKIE };
