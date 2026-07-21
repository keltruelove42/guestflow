# GuestFlow

Marketing + CRM for short/long-term rentals. Spec lives in [`docs/`](./docs); the clickable prototype is [`docs/prototype/guestflow.html`](./docs/prototype/guestflow.html).

## Quick start (M0)

```bash
# 1. Postgres
docker compose up -d

# 2. Env
cp .env.example .env

# 3. Install + DB
pnpm install
pnpm db:generate
pnpm db:push
pnpm db:seed   # optional — first demo login also seeds

# 4. Web
pnpm dev
# → http://localhost:3000  → Continue in demo mode
```

```bash
pnpm test          # packages/core vitest
pnpm dev:mobile    # Expo tab placeholders
```

## Deploy to the web (Vercel)

One-click from GitHub: import this repo on [Vercel](https://vercel.com/new), set **Root Directory** to `apps/web`, add `DATABASE_URL` + `APP_URL` + `CREDENTIALS_KEY`, deploy, then run `pnpm db:setup:prod` once against production Postgres.

Full steps: [`docs/11-deploy-vercel.md`](./docs/11-deploy-vercel.md).

```bash
pnpm deploy:build      # local production build
pnpm deploy:vercel     # CLI deploy (requires vercel login)
```

## Monorepo

| Path | Role |
|---|---|
| `apps/web` | Next.js App Router — UI + API |
| `apps/mobile` | Expo companion (placeholders until M4) |
| `packages/shared` | Zod schemas, enums, design tokens |
| `packages/db` | Prisma schema + seed |
| `packages/core` | Business logic + integration mocks |
| `packages/api-client` | Typed fetch client |

Build order: follow [`docs/10-build-plan.md`](./docs/10-build-plan.md). M0–M3 = demo-complete product; M6 = live Hostfully/StayFi/email/SMS.
