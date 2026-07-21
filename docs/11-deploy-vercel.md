# GuestFlow — deploy to Vercel (one-click from GitHub)

## 1. Create Postgres

Use [Neon](https://neon.tech), [Supabase](https://supabase.com), or [Railway](https://railway.app). Copy the connection string (`DATABASE_URL`).

## 2. Import the repo on Vercel

1. [vercel.com/new](https://vercel.com/new) → import `keltruelove42/guestflow` (or your fork).
2. **Root Directory:** `apps/web` (required — `apps/web/vercel.json` is configured for this).
3. Framework: Next.js (auto).
4. Leave Build/Install commands as detected from `vercel.json`.

## 3. Environment variables

In the Vercel project → Settings → Environment Variables, add at least:

| Name | Example / notes |
|------|-----------------|
| `DATABASE_URL` | Neon/Supabase Postgres URL |
| `APP_URL` | `https://your-app.vercel.app` (update after first deploy if needed) |
| `CREDENTIALS_KEY` | 64-char hex (or any long secret; hashed to 32 bytes) |
| `CRON_SECRET` | random string for job routes |

Optional later: `RESEND_API_KEY`, `EMAIL_FROM`, `TWILIO_*`, `META_APP_*`, etc. (see `.env.example`).

## 4. Deploy

Click **Deploy**. Or from your machine (repo root):

```bash
pnpm deploy:vercel
```

## 5. Initialize the database (once)

After the first successful deploy, point at production DB and push the schema:

```bash
DATABASE_URL="postgresql://..." pnpm db:setup:prod
# optional demo seed:
SEED=1 DATABASE_URL="postgresql://..." pnpm db:setup:prod
```

## 6. Custom domain

Vercel → Domains → add your domain, then set `APP_URL` to `https://yourdomain.com` and redeploy so OAuth/unsubscribe links match.

## Local production check

```bash
pnpm deploy:build          # prisma generate + next build
pnpm --filter @guestflow/web start
```
