/**
 * Best-effort in-memory rate limiter for abuse-prone endpoints (auth, public
 * forms). It throttles bursts within a single serverless instance — good
 * enough to blunt casual scripts and credential stuffing.
 *
 * NOTE: serverless spins up many instances, so this is NOT a hard global cap.
 * For production-grade limits across all instances, back `hit()` with a shared
 * store (Upstash Redis / Vercel KV) — swap the Map for a Redis INCR+EXPIRE and
 * the rest of the app is unchanged. See SECURITY.md.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Opportunistic cleanup so the Map can't grow unbounded on a warm instance.
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

export function rateLimit(
  key: string,
  opts: { max: number; windowMs: number },
): { ok: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, remaining: opts.max - 1, retryAfterMs: 0 };
  }
  b.count += 1;
  if (b.count > opts.max) {
    return { ok: false, remaining: 0, retryAfterMs: b.resetAt - now };
  }
  return { ok: true, remaining: opts.max - b.count, retryAfterMs: 0 };
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
