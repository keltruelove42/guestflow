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
