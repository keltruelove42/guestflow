# LeadCoda — Production Go-Live Checklist

Everything the now-live `main` needs, in one pass. Tick straight down.
Status legend: **[REQUIRED]** = app misbehaves without it · **[FEATURE]** =
optional, turns a feature on (degrades gracefully when absent).

---

## 1. Database — run one script (removes all guesswork)

Instead of tracking which migrations ran, run the single idempotent script
`migrations/RUN_ME_bring_db_current.sql` in the **Neon SQL Editor** (neondb
database). It creates anything missing and is safe to run twice. Paste the file
contents, click **Run**.

- [ ] Ran `RUN_ME_bring_db_current.sql` in Neon → success

**Verify it worked** — paste this and Run; every row should say `OK`:

```sql
SELECT 'BrandSettings table' AS item,
       to_regclass('"BrandSettings"') IS NOT NULL AS ok
UNION ALL SELECT 'GeneratedImage table', to_regclass('"GeneratedImage"') IS NOT NULL
UNION ALL SELECT 'SavedReport table', to_regclass('"SavedReport"') IS NOT NULL
UNION ALL SELECT 'Org.trialEndsAt', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Org' AND column_name='trialEndsAt')
UNION ALL SELECT 'Sequence.heroPhotoUrl', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Sequence' AND column_name='heroPhotoUrl')
UNION ALL SELECT 'User.emailVerifiedAt', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='User' AND column_name='emailVerifiedAt')
UNION ALL SELECT 'EMAIL_OPENED enum', EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='LeadEventType' AND e.enumlabel='EMAIL_OPENED')
UNION ALL SELECT 'CODE_REDEEMED enum', EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='LeadEventType' AND e.enumlabel='CODE_REDEEMED');
```

- [ ] Verification query returns `ok = true` for all 8 rows

---

## 2. Environment variables (Vercel → Settings → Environment Variables)

### Core — REQUIRED (app already relies on these)

- [ ] `DATABASE_URL` — Neon connection string
- [ ] `SESSION_SECRET` — **you set this ✓** (must be 32+ random chars; `openssl rand -base64 48` if unsure)
- [ ] `APP_URL` — must be `https://leadcoda.app` (email links, unsubscribe, OAuth callbacks)
- [ ] `CREDENTIALS_KEY` — encrypts stored integration credentials

### Feature toggles — optional (each shows a "not configured" message until set)

- [ ] `BLOB_READ_WRITE_TOKEN` **[FEATURE]** logo + hero + AI-image uploads. Create a **Public** Vercel Blob store (Storage tab) with the read-write-token box checked.
- [ ] `ANTHROPIC_API_KEY` **[FEATURE]** "Rewrite with AI" + AI-image prompt crafting
- [ ] `OPENAI_API_KEY` **[FEATURE]** AI image generation (Growth tier)
- [ ] `PLATFORM_RESEND_API_KEY` **[FEATURE]** white-glove managed email + sends the verification emails (or set `RESEND_API_KEY` + `EMAIL_FROM`)
- [ ] `EMAIL_FROM` **[FEATURE]** the From address for platform/transactional email
- [ ] `PLATFORM_TWILIO_ACCOUNT_SID` + `PLATFORM_TWILIO_AUTH_TOKEN` **[FEATURE]** white-glove managed SMS (master AC… + token, paid Twilio)
- [ ] `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` **[FEATURE]** signup CAPTCHA (Cloudflare → Turnstile → add site for leadcoda.app)
- [ ] `INBOUND_EMAIL_SECRET` **[RECOMMENDED]** protects the inbound-email, open-tracking, and Twilio webhooks
- [ ] `PLATFORM_ADMIN_EMAILS` **[RECOMMENDED]** set to `keltruelove42@gmail.com` (default already includes you; setting it explicitly is the safer posture)
- [ ] `CRON_SECRET` **[RECOMMENDED]** protects the follow-up tick job

### Already in use from before (leave as-is unless changing)
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `TWILIO_*`,
`META_*`, `TIKTOK_*`, `PINTEREST_*`, `HOSTFULLY_*`, `SEND_MODE`.

> After adding/changing any env var: **Deployments → latest → Redeploy** (vars only apply to new builds).

---

## 3. Webhooks (external dashboards)

- [ ] **Resend → Webhooks:** endpoint `https://leadcoda.app/api/webhooks/email/events?secret=YOUR_INBOUND_EMAIL_SECRET`, subscribe to **`email.opened`**. Also enable **Open Tracking** on the domain. → powers open-rate analytics.
- [ ] **Resend inbound** (reply capture, if used): route to `https://leadcoda.app/api/webhooks/email/inbound?secret=YOUR_INBOUND_EMAIL_SECRET`
- [ ] **Twilio** (each number's "A message comes in"): `https://leadcoda.app/api/webhooks/twilio/sms?secret=YOUR_INBOUND_EMAIL_SECRET`
- [ ] **Stripe** (already working if billing works): webhook → `https://leadcoda.app/api/v1/billing/webhook`, secret in `STRIPE_WEBHOOK_SECRET`

---

## 4. Smoke test (after deploy + migration)

- [ ] Sign in as **keltruelove42@gmail.com** → **🛡️ Admin** appears in the sidebar → `/admin` lists workspaces
- [ ] **Settings → Brand:** upload a logo, pick colors, live preview updates, Save
- [ ] **Follow-ups → edit a sequence:** "✨ Rewrite with AI" on a step (needs `ANTHROPIC_API_KEY`)
- [ ] **📊 Reports** (Growth/Enterprise): build + save a report; trial sees the locked teaser
- [ ] **New test signup:** CAPTCHA shows (if keys set) → verification banner appears → verification email arrives → clicking it clears the banner
- [ ] **Trial banner** shows "7 days left" with credit usage on a trial workspace
- [ ] Old `/billing` and `/integrations` links redirect into `/settings/…`

---

## 5. Security / housekeeping (do once)

- [ ] Rotate the **Neon password** (it was shared in chat) → update `DATABASE_URL` → redeploy
- [ ] Revoke the **GitHub token** used for pushes (Settings → Developer settings → Personal access tokens)
- [ ] Add a **no-scraping / no-reverse-engineering** clause to the Terms of Service (see SECURITY.md)

---

### Notes
- Migrations are additive; the one script above is safe to re-run anytime.
- Every AI/upload/CAPTCHA feature fails **gracefully** (a clear "not configured"
  message), so a missing optional key never breaks the app — it just leaves that
  feature off until you add the key and redeploy.
- Trial limits (7 days, 100 email / 25 SMS) are code constants in
  `packages/core/src/org/trial.ts` — tell me to change the numbers.
