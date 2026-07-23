/**
 * Cloudflare Turnstile (CAPTCHA) verification for signup.
 *
 * Gated on TURNSTILE_SECRET_KEY: when it's unset the check is skipped (so dev
 * and pre-configuration deploys keep working). Set both TURNSTILE_SECRET_KEY
 * (server) and NEXT_PUBLIC_TURNSTILE_SITE_KEY (client widget) to enforce.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function isTurnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return { ok: true }; // not configured → skip

  if (!token) return { ok: false, error: "Please complete the CAPTCHA." };

  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token);
    if (remoteIp) form.set("remoteip", remoteIp);

    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const data = (await res.json().catch(() => ({}))) as { success?: boolean };
    if (data.success) return { ok: true };
    return { ok: false, error: "CAPTCHA verification failed. Please try again." };
  } catch {
    // Fail closed on the network path — better to ask the user to retry than to
    // wave through a bot when Cloudflare is unreachable.
    return { ok: false, error: "Couldn't verify the CAPTCHA. Please try again." };
  }
}
