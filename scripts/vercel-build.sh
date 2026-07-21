#!/usr/bin/env bash
# Vercel / CI build for @guestflow/web (monorepo-safe).
# Run from repo root. Used by apps/web/vercel.json via filter install,
# or invoke directly: pnpm deploy:build
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Generating Prisma client"
pnpm --filter @guestflow/db generate

echo "==> Building @guestflow/web"
pnpm --filter @guestflow/web build

echo "==> Build complete"
