import { SignJWT, jwtVerify } from "jose";

const COOKIE = "gf_session";
const secret = () =>
  new TextEncoder().encode(
    process.env.SESSION_SECRET ?? "guestflow-dev-session-secret-change-me",
  );

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
