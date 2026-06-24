# Contributing to Drift Protocol

## Prerequisites

- Node.js 20+
- pnpm 9.12+
- Rust + `cargo` (for Soroban contracts)
- Docker (for local Postgres + Redis)

## Quick Start

```bash
pnpm install
pnpm infra:up          # start Postgres 16 + Redis 7
pnpm db:migrate        # apply migrations
pnpm dev               # start all services via Turborepo
```

## Project Layout

```
apps/
  api/        — NestJS REST API + Prisma
  realtime/   — Colyseus WebSocket server
  web/        — Next.js 14 frontend
packages/
  shared/     — Domain types, physics sim, events
  contracts/  — Soroban smart contracts (Rust)
```

## Code Quality

```bash
pnpm lint          # ESLint across all packages
pnpm typecheck     # tsc --noEmit across all packages
pnpm format        # Prettier write (requires prettier-plugin-tailwindcss)
pnpm test          # All test suites
```

## Testing

| Layer | Tool | Command |
|-------|------|---------|
| Soroban contracts | `cargo test` | `cd packages/contracts/marketplace-escrow && cargo test` |
| Shared package | Vitest | `pnpm --filter @drift/shared test` |
| API (unit) | Jest + ts-jest | `pnpm --filter @drift/api test` |
| Web (type guards) | Vitest | `pnpm --filter @drift/web test` |

Add tests for any new feature. Minimum: one happy-path + one failure case.

## Commit Style

Follow [Conventional Commits](https://www.conventionalcommits.org):

```
feat(scope): add something new
fix(scope): correct a bug
chore(scope): housekeeping
test(scope): add / fix tests
docs: update documentation
security: harden auth or input validation
perf(scope): measurable performance improvement
```

## Database Changes

1. Edit `apps/api/prisma/schema.prisma`
2. Run `pnpm db:migrate` — generates and applies migration
3. Commit the migration file alongside the schema change

## Smart Contract Changes

1. Edit `packages/contracts/<contract>/src/lib.rs`
2. Run `cargo test` inside the contract directory
3. Build WASM: `cargo build --target wasm32-unknown-unknown --release`
4. Update `scripts/deploy-*.ts` if the interface changes

## Branch Strategy

- `main` — production-ready; requires passing CI
- Feature branches: `feat/<short-description>`
- Hotfixes: `fix/<short-description>`

Open a PR against `main` with a description of what changed and why.
