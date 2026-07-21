import { cookies } from "next/headers";
import { prisma } from "@guestflow/db";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "./session";

/**
 * Verify JWT and that the user/org still exist (seed wipes can invalidate cookies).
 */
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, orgId: true, email: true, name: true },
  });
  if (!user || user.orgId !== payload.orgId) {
    return null;
  }
  return {
    sub: user.id,
    email: user.email,
    name: user.name,
    orgId: user.orgId,
  };
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  return session;
}

export async function getSessionUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: { org: true },
  });
  return user;
}

/** True when Supabase env is configured for real auth */
export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
