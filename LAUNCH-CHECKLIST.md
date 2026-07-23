# LeadCoda Launch Checklist

Everything left to finish the cleanup + Phase 1 + Phase 2 rollout.
Code is fully pushed to GitHub; database schema is already applied in Neon (both SQL runs done ✅). What remains is merging, Vercel config, and verification.

---

## 1. Merge the three PRs, in order

Each link opens the PR form pre-filled — just click **Create pull request**, then **Merge**. If a PR already exists, skip to merging it.

**PR 1 — Cleanup** (no behavior changes; site should look identical after deploy):
https://github.com/keltruelove42/guestflow/compare/main...cleanup/readability?quick_pull=1&title=Cleanup%3A%20shared%20UI%20primitives%2C%20page%20splits%2C%20dead-code%20removal%2C%20LeadCoda%20branding

**PR 2 — Phase 1: brand settings, branded emails, AI rewrite, onboarding, settings hub**
(base branch shows `cleanup/readability` — after PR 1 merges, GitHub retargets it to `main` automatically; if it doesn't, change the base dropdown to `main`):
https://github.com/keltruelove42/guestflow/compare/cleanup/readability...feature/brand-mvp?quick_pull=1&title=LeadCoda%20MVP%20Phase%201

**PR 3 — Phase 2: AI image generation (Growth/Enterprise)**
(base `feature/brand-mvp`, same auto-retarget story):
https://github.com/keltruelove42/guestflow/compare/feature/brand-mvp...feature/image-gen?quick_pull=1&title=Phase%202%3A%20AI%20image%20generation%20for%20hero%20photos%20%28Growth/Enterprise%29

Each merge triggers a Vercel deploy of the new `main`.

---

## 2. Create the Vercel Blob store (you were mid-way here when the outage hit)

Vercel project **guestflow-web** → **Storage** tab → **Create Blob store**:

- Name: `leadcoda-web-blob` (anything is fine)
- Region: iad1 is fine
- **Access: PUBLIC** — not private. These blobs are your logo and email hero images, embedded as plain `<img>` URLs in outgoing emails; recipients' mail clients must load them with no token. Public only affects *reading* — uploads always require the server-side token.
- **CHECK the box "Add a read-write token env var to this connection"** — this creates `BLOB_READ_WRITE_TOKEN`, which is the variable the app actually reads. (The default `BLOB_STORE_ID` / `BLOB_WEBHOOK_PUBLIC_KEY` vars are not used by the app.)
- If you forget the checkbox: open the store's settings afterward, copy the read-write token, and add it manually as env var `BLOB_READ_WRITE_TOKEN`.

Enables: logo upload (Settings → Brand, signup), hero photo upload (sequence editor), and image-gen storage.

---

## 3. Add the two API keys (Settings → Environment Variables)

| Variable | Where to get it | What it turns on |
|---|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API keys | "Rewrite with AI" button + prompt-crafting for image gen |
| `OPENAI_API_KEY` | platform.openai.com → API keys | The image-rendering half of "Generate image" |
| `PLATFORM_RESEND_API_KEY` | resend.com → API keys (your account) | White-glove managed email: clients' domains verified under YOUR Resend account. Per client: their workspace → Settings → Integrations → Managed Sending card → enter their domain → add the shown DNS records at their DNS host → verify. Sender priority: managed domain > client's own Resend > `RESEND_API_KEY` fallback (optional; sends from your `EMAIL_FROM`). |
| `PLATFORM_TWILIO_ACCOUNT_SID` | Twilio Console home — master **Account SID (AC…)**, NOT an SK… API key | White-glove managed SMS: per client, the Managed Sending card creates a subaccount under your master, buys an SMS number in their chosen area code, and tracks A2P 10DLC registration. Master account must be upgraded (paid) — trials can't create subaccounts. Number costs roll up to your Twilio bill. |
| `PLATFORM_TWILIO_AUTH_TOKEN` | Twilio Console home — master Auth Token | Pairs with the SID above. |

Also verify `APP_URL` = `https://leadcoda.app` (used in unsubscribe links and email footers).

Until these exist, the features show a clean "not configured yet" message — nothing breaks.

---

## 4. Redeploy

Env vars only apply to NEW deployments. After steps 2–3:
**Deployments → latest → ⋯ → Redeploy** (or push any commit).

---

## 5. Smoke test

- **Settings → Brand**: upload logo, pick colors, watch the live email preview, Save.
- **Follow-ups → edit a sequence**: try **✨ Rewrite with AI** on a step (Undo link appears after).
- **Hero photo**: upload an image on a sequence; send yourself a test email (simulate lead → sequence) and check the branded header + hero render.
- **Generate image**: only works when the org plan is GROWTH or ENTERPRISE — a trial workspace correctly shows the ⚡ upgrade chip instead. That's the gate working.
- **Old links**: /billing and /integrations should redirect into /settings/… (Stripe & OAuth returns depend on this).
- **Signup**: run through a fresh signup — industry → confirm brand (live preview) → starter sequence preview → dashboard.

---

## 6. Security housekeeping (do last)

- **Rotate the Neon password** (it was pasted in chat): Neon console → Roles & Databases → `neondb_owner` → Reset password → update `DATABASE_URL` in Vercel → redeploy.
- **Revoke the GitHub token**: github.com → Settings → Developer settings → Personal access tokens → revoke `leadcoda-cleanup` (or let it expire).

---

## Reference

- Neon schema: already applied — `BrandSettings` table, `Sequence.heroPhotoUrl` column, `GeneratedImage` table. All additive; safe to re-run the SQL from the PR descriptions if ever unsure.
- Image provider: OpenAI gpt-image, isolated in `packages/core/src/ai/imageGen.ts` (env `OPENAI_IMAGE_MODEL` to change model; swap providers by editing that one file).
- Plan gating: server-side in `POST /api/v1/ai/generate-image` via `canGenerateImages()` — GROWTH / ENTERPRISE only.
- Asset library (gallery of generated/uploaded images): deferred; `GeneratedImage` records everything, so it can be built later with no migration.

---
---

# PART 2 — Trials, Admin Console & Growth Analytics

New work on branch `feature/trials-admin-analytics`. Same pattern as before: merge, run one SQL migration, add one webhook. No new required env vars.

## A. Merge the PR

Open the pre-filled PR (base is `feature/image-gen`, so merge the three Part-1 PRs first; GitHub then retargets this to `main` on its own):

https://github.com/keltruelove42/guestflow/compare/feature/image-gen...feature/trials-admin-analytics?quick_pull=1&title=Trials%2C%20admin%20console%2C%20and%20Growth%20touchpoint%20analytics

## B. Run the DB migration (Neon SQL Editor, `neondb` database)

The exact SQL is in the repo at `migrations/003_trials_admin_analytics.sql`. It's additive + idempotent (safe to run twice). Paste and Run:

```sql
ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
ALTER TYPE "LeadEventType" ADD VALUE IF NOT EXISTS 'EMAIL_OPENED';
ALTER TYPE "LeadEventType" ADD VALUE IF NOT EXISTS 'CODE_REDEEMED';
```

Optional — start a 7-day clock on workspaces that are ALREADY on trial (otherwise
existing trials stay unlimited and only new signups get the countdown):

```sql
UPDATE "Org" SET "trialEndsAt" = NOW() + INTERVAL '7 days'
 WHERE "plan" = 'TRIAL' AND "trialEndsAt" IS NULL;
```

## C. Turn on email-open tracking (Resend webhook)

Needed for the "open rate" number in Growth analytics. In the **Resend dashboard → Webhooks → Add endpoint**:

- Endpoint URL: `https://leadcoda.app/api/webhooks/email/events?secret=YOUR_INBOUND_EMAIL_SECRET`
  (reuse the same value you set for `INBOUND_EMAIL_SECRET`; if you never set that var, either add it now or drop the `?secret=...` — the endpoint just won't be auth-protected).
- Event to subscribe: **`email.opened`** (add `email.delivered`/`email.bounced` too if you like — the endpoint ignores them cleanly).
- Also make sure **Open tracking** is enabled on your Resend domain/account settings, or Resend never fires the event.

Reply capture (the existing inbound webhook) is separate and unchanged.

## D. Env vars — nothing required

- The admin console is already gated to `keltruelove42@gmail.com` in code. Only set `PLATFORM_ADMIN_EMAILS` (comma-separated) if you want to ADD or CHANGE admins later. Then redeploy.
- Trial credit limits (100 email / 25 SMS) and length (7 days) are code constants in `packages/core/src/org/trial.ts` — tell me to change them, no env var.

## E. Redeploy, then smoke-test

- **Trial banner**: a fresh signup shows "7 days left…" with Email/SMS credit usage; the billing page shows the trial usage card.
- **Admin console**: log in as keltruelove42@gmail.com → a 🛡️ Admin item appears in the sidebar → `/admin` lists all workspaces. Open one → extend trial, change plan, and delete (delete needs you to type the org name). Non-admins get a 404 at `/admin`.
- **Growth analytics**: on a GROWTH/ENTERPRISE workspace the dashboard's new "Analytics" section shows open/reply/redemption/booking by touchpoint; on trial/starter it shows the locked "Upgrade to Growth" teaser.
- **Opens**: after the Resend webhook is live, open a test email you sent yourself → within a minute the lead timeline shows "Email opened" and the open-rate number moves.

## F. One known gap — logging code redemptions

The analytics *displays* code redemptions and the API to record one exists
(`POST /api/v1/leads/[id]/redemptions` with `{ code }`), but there is **no button
in the UI yet** to log a redemption — so that number stays at 0 until something
calls it. Two options: (1) I add a small "Log redemption" action on the lead
detail page, or (2) you call the endpoint from wherever redemptions actually
happen (e.g. your booking/checkout flow). Say which and I'll wire it.

---

## Consolidated env-var checklist (all parts)

| Variable | Required? | Purpose |
|---|---|---|
| `DATABASE_URL` | already set | Neon Postgres |
| `APP_URL` | verify = `https://leadcoda.app` | email links, unsubscribe, OAuth |
| `CREDENTIALS_KEY`, `SESSION_SECRET` | already set | encryption / auth |
| `BLOB_READ_WRITE_TOKEN` | for uploads + image gen | Vercel Blob (Public store + token checkbox) |
| `ANTHROPIC_API_KEY` | for AI rewrite + image prompts | Claude |
| `OPENAI_API_KEY` | for image generation | gpt-image |
| `PLATFORM_RESEND_API_KEY` | for white-glove managed email | your Resend account |
| `PLATFORM_TWILIO_ACCOUNT_SID` / `PLATFORM_TWILIO_AUTH_TOKEN` | for white-glove managed SMS | your Twilio master (AC…, paid account) |
| `INBOUND_EMAIL_SECRET` | recommended | protects the inbound + open webhooks |
| `PLATFORM_ADMIN_EMAILS` | optional | override/extend admin list (default = keltruelove42@gmail.com) |
| `RESEND_API_KEY` / `EMAIL_FROM` | optional fallback | platform-wide default sender when no managed/own domain |
