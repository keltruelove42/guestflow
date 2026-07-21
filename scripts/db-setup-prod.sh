#!/usr/bin/env bash
# One-shot production database setup against DATABASE_URL.
# Usage:
#   DATABASE_URL="postgresql://..." pnpm db:setup:prod
#   # or after linking Vercel env locally:
#   vercel env pull .env.production.local
#   set -a && source .env.production.local && set +a && pnpm db:setup:prod
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set."
  echo "Create a Postgres DB (Neon/Supabase/Railway), then:"
  echo "  DATABASE_URL='postgresql://...' pnpm db:setup:prod"
  exit 1
fi

echo "==> Pushing schema to production database"
pnpm --filter @guestflow/db push

if [[ "${SEED:-0}" == "1" ]]; then
  echo "==> Seeding demo data (SEED=1)"
  pnpm --filter @guestflow/db seed
else
  echo "==> Skipping seed (set SEED=1 to load demo data)"
fi

echo "==> Database ready"
