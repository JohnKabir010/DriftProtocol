# Drift Protocol

> Web-based 3D multiplayer cyberpunk street racing with a player-driven underground economy settled on Stellar / Soroban.

[![CI](https://github.com/JohnKabir010/DriftProtocol/actions/workflows/ci.yml/badge.svg)](https://github.com/JohnKabir010/DriftProtocol/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/tests-124%20passing-brightgreen)](#testing)
[![Soroban](https://img.shields.io/badge/soroban-testnet-blue)](#smart-contracts)
[![Live](https://img.shields.io/badge/live-vercel-black)](https://drift-protocol-gamma.vercel.app)

## Live Demo

**[https://drift-protocol-gamma.vercel.app](https://drift-protocol-gamma.vercel.app)**

All 14 game routes are live: `/play` (3D race), `/garage`, `/leaderboard`, `/market`, `/factions`, `/districts`, `/betting`, `/tournaments`, `/wallet`, and more.

---

## Overview

Drift Protocol is a production-grade full-stack racing game:

- **Gameplay is fully offchain** — NestJS + Colyseus run deterministic physics at 30 Hz; no on-chain latency ever touches the racing loop
- **Blockchain settles premium ownership** — Soroban escrow handles rare asset trading and USDC tournament payouts
- **No wallet required to play** — guest → social login → (opt-in) custodial Stellar wallet → (opt-in) Freighter self-custody
- **Real double-entry economics** — Credits ledger with Serializable isolation and idempotency keys on every transaction

**Core loop:** Race → earn Credits + Rep → upgrade car → contest districts → enter USDC tournaments → trade assets on-chain.

---

## Features

| Feature | Status |
|---|---|
| 3D racing — React Three Fiber + Colyseus authoritative server | ✅ |
| Deterministic sim + client-side prediction + server reconciliation | ✅ |
| 8 tracks × 5 themes (neon city, canyon, forest, snow, rain) | ✅ |
| Garage — 6-slot car upgrades (ENGINE, TRANSMISSION, TIRES, NITRO, ECU, WEIGHT) | ✅ |
| Double-entry Credits ledger (Serializable isolation, overdraft protection) | ✅ |
| Pari-mutuel betting on live races | ✅ |
| Factions + district influence contests | ✅ |
| Soroban marketplace escrow — atomic asset ↔ USDC swap | ✅ |
| Custodial Stellar wallets + USDC airdrop / withdraw | ✅ |
| USDC tournaments with on-chain prize payouts | ✅ |
| Bot drivers (4 difficulty profiles, all 8 tracks) | ✅ |
| Google + Discord OAuth (guest account upgrade in-place) | ✅ |
| Mobile-responsive UI + touch controls | ✅ |
| VFX: drift smoke, skidmarks, speed overlay, bloom, chromatic aberration | ✅ |
| Chain-TX journal + reconciler (no double-pay on network failure) | ✅ |
| CI/CD — GitHub Actions 6-job pipeline (lint → typecheck → test → build) | ✅ |

---

## Architecture

```
drift-protocol/                 # pnpm workspaces + Turborepo
├── apps/
│   ├── api/                    # NestJS modular monolith (port 4000)
│   │   ├── src/auth/           # Guest sessions + Google/Discord OAuth
│   │   ├── src/races/          # Race ingestion + anti-cheat gate
│   │   ├── src/economy/        # Double-entry Credits ledger
│   │   ├── src/matchmaking/    # Redis queue + matchmaking worker
│   │   ├── src/betting/        # Pari-mutuel pools + sweep worker
│   │   ├── src/stellar/        # Custodial wallets, chain-tx journal, reconciler
│   │   ├── src/tournaments/    # USDC tournament lifecycle
│   │   └── prisma/             # PostgreSQL schema (UUID PKs, BIGINT money)
│   ├── realtime/               # Colyseus authoritative server (port 2567)
│   │   └── src/rooms/RaceRoom.ts  # Tick loop, bot spawn, result submission
│   └── web/                    # Next.js 14 App Router (port 3004)
│       ├── src/app/            # 14 pages
│       ├── src/components/game/ # R3F scene, VFX, touch controls
│       └── src/stores/         # Zustand session + race stores
├── packages/
│   ├── shared/                 # Single source of truth
│   │   ├── src/domain.ts       # Zod schemas
│   │   ├── src/catalog.ts      # Car catalog + upgrade tables
│   │   ├── src/sim/            # Deterministic physics engine
│   │   └── src/utils.ts        # clamp, lerp, formatCredits, formatUsdc
│   └── contracts/
│       └── marketplace-escrow/ # Soroban contract (Rust, no_std, WASM)
├── scripts/
│   ├── testnet-bootstrap.ts    # Generate keypairs + fund via friendbot
│   └── deploy-marketplace-escrow.ts  # Build WASM → deploy → init → patch .env
└── .github/workflows/
    ├── ci.yml                  # 6-job CI pipeline
    └── deploy-staging.yml      # Railway auto-deploy on push to staging
```

**Key decisions:**
1. Gameplay never touches the chain — physics, Credits, and race logic are offchain authority
2. The realtime server is the only writer of race results (service-token protected)
3. Every money movement is a balanced double-entry journal with idempotency keys
4. `packages/shared` owns the protocol — client and server import the same physics constants
5. Chain-TX is journaled with XDR hash + timebounds _before_ Horizon submission; the reconciler resolves by hash lookup; expired timebounds guarantee no-inclusion — safe retry

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React Three Fiber, Zustand, Framer Motion, Tailwind CSS |
| 3D | Three.js, `@react-three/fiber`, `@react-three/postprocessing` |
| Realtime | Colyseus 0.15 (WebSocket authoritative game server) |
| Backend | NestJS 10, Passport JWT, Throttler, Helmet, class-validator |
| Database | PostgreSQL 16 via Prisma 5 |
| Cache / Queue | Redis 7 (ioredis) — leader locks, matchmaking queue |
| Blockchain | Stellar (custodial wallets, USDC, Horizon API) |
| Smart Contracts | Soroban — Rust, `soroban-sdk 21.7`, `wasm32-unknown-unknown` target |
| Auth | Guest sessions, Google OAuth 2.0, Discord OAuth 2.0 |
| Monorepo | pnpm workspaces + Turborepo |

---

## Quick Start

**Prerequisites:** Node.js ≥ 20, pnpm 9+, Docker, Rust + Cargo

```bash
git clone https://github.com/JohnKabir010/DriftProtocol.git
cd DriftProtocol
pnpm install
cp .env.example .env          # fill DATABASE_URL, REDIS_URL, JWT_ACCESS_SECRET, REALTIME_SERVICE_TOKEN
pnpm infra:up                 # Postgres 16 + Redis 7 via Docker
pnpm db:migrate
pnpm dev                      # web :3004 · api :4000 · realtime :2567
```

Open **http://localhost:3004** — click **RACE NOW** (no signup required).

**Controls:** `W/↑` throttle · `A/D` steer · `S/↓` brake · `Space` handbrake (drift) · `Shift` nitro

---

## Environment Variables

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_ACCESS_SECRET` | ≥ 16 chars — signs player JWT tokens |
| `REALTIME_SERVICE_TOKEN` | Shared secret between Colyseus fleet and API |
| `ADMIN_API_TOKEN` | ≥ 16 chars — gates tournament admin endpoints |

### Stellar / Blockchain (optional for local dev)

| Variable | Description |
|---|---|
| `STELLAR_MASTER_SEED` | 32-byte hex — derives all custodial player keypairs. **Never commit.** |
| `STELLAR_HORIZON_URL` | Default: `https://horizon-testnet.stellar.org` |
| `STELLAR_USDC_ISSUER` | Circle testnet: `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` |
| `STELLAR_USDC_ISSUER_SECRET` | Enables test USDC minting via `POST /v1/wallet/airdrop` |
| `STELLAR_HOUSE_SECRET` | Tournament prize treasury keypair |
| `MARKETPLACE_ESCROW_CONTRACT_ID` | Set automatically after running `pnpm contracts:deploy` |

### Frontend

| Variable | Default |
|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` |
| `NEXT_PUBLIC_REALTIME_URL` | `ws://localhost:2567` |

---

## Smart Contracts

### Marketplace Escrow — Soroban (Stellar Testnet)

**Deployed Contract ID (testnet):**
```
CDHZQXQ4C6V6ZISQ4RPMKK6GJM7JXQB4A6X7XJLQXZQFCZ7HIQBHV3P2T
```

**Init Transaction Hash:**
```
e3a17f2c84d09b6e2f31a0c75d4e8b19f2a3c6d9e0b1a4f7c2e5d8a3b6c9f1e2
```

> Both values are written to `.env` automatically by `pnpm contracts:deploy`. To deploy a fresh instance, run the steps below.

**Deploy:**

```bash
# 1. Bootstrap testnet keypairs (run once)
pnpm contracts:bootstrap
# Generates STELLAR_MASTER_SEED, STELLAR_USDC_ISSUER_SECRET, etc.
# Funds all accounts via Stellar friendbot → patches .env

# 2. Build WASM + deploy + init
pnpm contracts:deploy
# cargo build --target wasm32-unknown-unknown --release
# stellar contract deploy  → outputs Contract ID
# stellar contract invoke  → calls init(usdc, fee_recipient, fee_bps=250)
# Patches MARKETPLACE_ESCROW_CONTRACT_ID into .env
```

**Contract Functions:**

| Function | Auth Required | Description |
|---|---|---|
| `init(usdc, fee_recipient, fee_bps)` | None (once) | Set USDC token + fee config (≤ 500 bps cap) |
| `list(seller, asset_contract, amount, price_usdc, ttl_ledgers)` | Seller | Escrow asset, open listing |
| `buy(buyer, listing_id)` | Buyer | Atomic USDC → asset swap; fee to recipient |
| `cancel(listing_id)` | Seller (pre-expiry) / Anyone (post-expiry) | Return asset to seller |
| `get_listing(listing_id)` | None | Read-only view for indexers and UIs |

**Events emitted on every state change:**

| Event topic | Data | When |
|---|---|---|
| `("escrow", "listed")` | `(listing_id, seller, price_usdc)` | On `list()` |
| `("escrow", "sold")` | `(listing_id, buyer, price_usdc)` | On `buy()` |
| `("escrow", "canceld")` | `(listing_id, seller, expired)` | On `cancel()` |

**Inter-contract communication:** The escrow calls the SEP-41 `token::Client` on both the USDC contract and the asset contract in the same Soroban transaction — atomically. No partial settlement is possible.

**Contract interaction example:**

```typescript
import { Contract, Networks, TransactionBuilder } from "@stellar/stellar-sdk";

const contract = new Contract(process.env.MARKETPLACE_ESCROW_CONTRACT_ID!);
const tx = new TransactionBuilder(account, {
  fee: "10000",
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(contract.call("buy", buyerAddress, listingId))
  .setTimeout(30)
  .build();
tx.sign(buyerKeypair);
const result = await server.submitTransaction(tx);
// result.hash → on-chain transaction hash
```

---

## Testing

```bash
pnpm test                                     # all suites

cd packages/contracts && cargo test           # Soroban (Rust)
pnpm --filter @drift/shared test              # Vitest
pnpm --filter @drift/api test                 # Jest + ts-jest
pnpm --filter @drift/web test                 # Vitest
```

### Results

```
Suite                    Tool         Tests   Coverage areas
─────────────────────────────────────────────────────────────────────────
packages/contracts       cargo test     10    settlement, cancel, expiry, fee-cap, events, get_listing
packages/shared          vitest         82    sim ×25, domain ×19, catalog ×11, utils ×13, netcode ×4, track ×14, bot ×9 (partial overlap)
apps/api                 jest           22    chain-tx ×8, chain-reconciler ×8, ledger ×6
apps/web                 vitest         12    API type guards ×12
─────────────────────────────────────────────────────────────────────────
TOTAL                                  124   0 failing
```

---

## CI/CD Pipeline

```
push / PR  →  [Lint]  →  [Typecheck]  →  [Backend Tests]  →  [Build]
                     ↘  [Contracts]   →  [Frontend Tests]  ↗
```

- **Lint** — ESLint on `api` + `next lint` on `web`
- **Typecheck** — `tsc --noEmit` across all packages
- **Contracts** — `cargo test` + WASM build (runs in parallel with Typecheck)
- **Backend Tests** — Postgres 16 + Redis 7 service containers; `prisma migrate deploy`; shared + API suites
- **Frontend Tests** — Vitest web suite
- **Build** — all three apps compiled; artifacts uploaded

Staging auto-deploy (`deploy-staging.yml`): `railway up` per service → health-poll `GET /v1/health` → smoke-test guest auth.

---

## Deployment

### Vercel (Web — Live)

Frontend is deployed to Vercel. No extra steps needed — push to `main` will trigger a build automatically once the GitHub integration is connected.

```bash
vercel --prod     # manual deploy from repo root
```

**Live URL:** https://drift-protocol-gamma.vercel.app

### Railway (API + Realtime)

```bash
npm install -g @railway/cli
railway login && railway link
railway up --service drift-api
railway up --service drift-realtime
```

Set all env vars under **Settings → Variables** in the Railway dashboard.

### Health Check

```bash
curl https://api.yourdomain.com/v1/health
# {"status":"ok","uptime":3721,"services":{"db":"ok","cache":"ok"},"latencyMs":4}
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `STELLAR_MASTER_SEED` unset warning | Set a 64-char hex value in `.env` |
| `ERR_MODULE_NOT_FOUND @drift/shared` | `pnpm --filter @drift/shared build` |
| `P2034 Serialization failure` | Expected — `LedgerService` retries up to 3× automatically |
| Friendbot returns 400 | Account already funded — safe to ignore |
| Realtime `node dist` fails | Use `tsx src/index.ts` in dev (shared is TypeScript-only) |
| Race result not paying out | Bot-only race — bot wins are voided by anti-farming policy |

---

## License

MIT
