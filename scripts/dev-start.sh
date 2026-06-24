#!/usr/bin/env bash
# Drift Protocol — full local dev stack startup
# Usage: bash scripts/dev-start.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
info() { printf '  \033[36m→\033[0m %s\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
err()  { printf '  \033[31m✗\033[0m %s\n' "$*"; }

bold "🏎  Drift Protocol — Dev Stack"
echo ""

# ── Check prerequisites ──────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  err ".env not found. Run: pnpm tsx scripts/testnet-bootstrap.ts"
  exit 1
fi

if ! command -v docker &>/dev/null; then
  err "Docker not found. Install Docker Desktop."
  exit 1
fi

# ── Infrastructure ───────────────────────────────────────────────────────────
bold "1/4  Starting Postgres + Redis…"
docker compose up -d --wait
ok "Infrastructure ready"

# ── Database ─────────────────────────────────────────────────────────────────
bold "2/4  Applying migrations…"
pnpm --filter @drift/api exec prisma migrate dev --name "" --skip-generate 2>/dev/null || \
pnpm --filter @drift/api exec prisma migrate deploy
ok "Migrations applied"

bold "      Seeding database…"
pnpm --filter @drift/api exec prisma db seed 2>/dev/null && ok "Database seeded" || info "Seed skipped (already seeded)"

# ── Build shared ─────────────────────────────────────────────────────────────
bold "3/4  Building shared package…"
pnpm --filter @drift/shared build
ok "@drift/shared built"

# ── Launch services ──────────────────────────────────────────────────────────
bold "4/4  Starting services…"
echo ""
info "API       → http://localhost:4000"
info "Realtime  → ws://localhost:2567"
info "Web       → http://localhost:3000"
echo ""
info "Press Ctrl+C to stop all services"
echo ""

# Use pnpm's parallel dev execution
exec pnpm dev
