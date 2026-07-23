# LeadCoda — Security Posture

Written after a full audit against a real threat model: bad actors on a free
trial or hitting public endpoints who want to abuse the sending infrastructure,
scrape/enumerate data, farm fake accounts, reach other tenants' data, or copy
the product. This documents what's now hardened, and — honestly — what code
protection can and can't do.

## Can I hide my code so people can't steal or replicate the platform?

**The valuable half is already invisible.** LeadCoda is split into a server side
and a browser side. Everything that *is* the product — the sending pipeline,
trial/credit logic, AI prompt-crafting, the analytics engine, all business rules
in `packages/core` and every `/api` route — runs on the server and is **never
sent to the browser**. A trial user, a scraper, or a competitor cannot download
it. That's where the real IP lives, and it's protected by architecture, not luck.

**The browser half cannot be truly hidden — for anyone, ever.** Any web app has
to ship JavaScript to the browser to render, and any visitor can open dev-tools
and read it. This is true of every website including the biggest ones. What we
*can* do is raise the cost and remove freebies, which is now done:

- **Source maps are off in production** (`productionBrowserSourceMaps: false`),
  so what ships is minified/mangled — readable in principle, but not your neat
  original source with comments and names.
- **`X-Powered-By` is removed** and security headers are set so the stack is less
  obvious to fingerprint.
- **No secrets in the bundle** — verified: only genuinely-public values use the
  `NEXT_PUBLIC_` prefix; API keys stay server-side.

**The honest conclusion:** someone determined can see your minified front-end and
your public API shape, but they cannot get your server logic, your data, or a
working copy of the platform. Replication is deterred by (a) the hidden backend,
(b) your data + sending reputation + integrations moat, and (c) legal terms.
Add an explicit "no scraping / no reverse-engineering / no automated access"
clause to your Terms of Service — that's what makes enforcement possible when
technical measures reach their limit.

## What was hardened in this pass

| Fix | Risk closed |
|---|---|
| **`SESSION_SECRET` now required in production** (fail-closed, ≥32 chars; was a hardcoded fallback) | Forged login tokens for any org — total cross-tenant takeover |
| **Login no longer sets passwords** on passwordless accounts; must use invite/reset | Anyone knowing an email could claim the account on first login |
| **Login + signup + public booking rate-limited** (per-IP / per-email) | Credential stuffing, account farming, booking/lead spam |
| **Disposable-email domains blocked at signup** | Automated trial-account farming to harvest send credits |
| **Managed email/SMS provisioning gated to paid plans** | Trial users buying Twilio numbers / registering domains on *your* account (your money + reputation) |
| **Public booking confirmation: recipient name escaped + rate-limited** | HTML injection into confirmation emails; using your sender to spam arbitrary addresses |
| **SVG uploads removed** from the allow-list | Script-carrying SVGs hosted on your public blob store |
| **Twilio inbound webhook shared-secret gate** (configure URL with `?secret=`) | Forged inbound SMS injecting fake replies / forcing opt-outs |
| **Security headers** (HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) | Clickjacking, MIME sniffing, referrer leakage |

Already solid (verified, no change needed): email-template HTML fully escapes
brand/merge content; API routes are consistently org-scoped (no cross-tenant
IDOR found); Stripe webhook verifies its signature; passwords use scrypt with a
random salt and constant-time compare.

## Required deploy change

**Set `SESSION_SECRET` in Vercel** (Production, and Preview if you use it) to a
long random string — e.g. run `openssl rand -base64 48` and paste the result.
The app now refuses to start in production without it (that's the point — no
weak default). If the app was relying on the old fallback, this is mandatory
before the next deploy.

## Recommended next steps (need a decision or infra)

These are real improvements I did not auto-enable because they need a product
decision, a paid service, or could interrupt a live flow:

1. **Email verification before first live send.** The strongest anti-abuse
   control for a messaging platform: a trial account can accumulate credits but
   can't actually send to strangers until it confirms its own email. ~½ day.
2. **CAPTCHA on signup + public booking** (Cloudflare Turnstile is free). Stops
   headless-browser farming that per-IP limits don't fully cover.
3. **Distributed rate limiting** (Upstash Redis / Vercel KV). The current limiter
   is best-effort *per serverless instance*; a shared store makes limits global
   and hard. The code is structured so this is a one-function swap
   (`apps/web/lib/rate-limit.ts`).
4. **Full webhook signature verification** for Twilio (`X-Twilio-Signature`) and
   Resend (Svix), replacing the shared-secret stopgap.
5. **Global platform send ceiling** independent of per-org trial credits, so no
   combination of accounts can exceed a daily platform-wide send cap.
6. **Move platform-admin off an email string to a DB role/flag** (currently
   `PLATFORM_ADMIN_EMAILS`, default your email) — and register that email so
   nobody else can. Set `PLATFORM_ADMIN_EMAILS` explicitly in Vercel regardless.
7. **Require `INBOUND_EMAIL_SECRET`** and shorten the 30-day session lifetime /
   add server-side revocation for "log out everywhere."

Tell me which of these to build next — email verification (#1) and Turnstile
(#2) give the most abuse protection per hour of work.
