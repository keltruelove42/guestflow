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
