# DRIFT PROTOCOL

Web-based 3D multiplayer cyberpunk street racing with a player-driven economy. Gameplay is fully offchain (authoritative servers); Stellar/Soroban settles premium ownership, escrow, and tournament payouts — invisibly.

**Read first:** [`docs/01-MASTER-PLAN.md`](docs/01-MASTER-PLAN.md) — the complete product, architecture, economy, and go-to-market plan.

## Monorepo

```
drift-protocol/
├─ apps/
│  ├─ web/        Next.js 14 + React Three Fiber client (game, HUD, garage, market)
│  ├─ api/        NestJS modular monolith (auth, players, races, ledger, matchmaking)
│  └─ realtime/   Colyseus authoritative race servers (fixed-tick sim, validation)
├─ packages/
│  ├─ shared/     Zod schemas, WS protocol types, physics constants (single source of truth)
│  └─ contracts/  Soroban contracts (Rust) — settlement & registries only
├─ docs/          Master plan & ADRs
└─ docker-compose.yml   Local Postgres 16 + Redis 7
```

## Quick start

```bash
pnpm install
cp .env.example .env
pnpm infra:up            # Postgres + Redis via Docker
pnpm db:migrate          # Prisma migrations
pnpm dev                 # web :3000 · api :4000 · realtime :2567
```

Open http://localhost:3000 → **RACE NOW**. WASD to drive, Space handbrake, Shift nitro.

Contracts (requires Rust + stellar-cli):

```bash
cd packages/contracts
cargo test                                   # unit tests incl. escrow settlement
stellar contract build                       # wasm for testnet deploy
```

## Architecture rules (enforced, not aspirational)

1. **Gameplay never touches the chain.** Physics, race logic, and Credits live on the server. Soroban contracts are settlement/registry only.
2. **The realtime server is the only writer of race results** (service-token channel into the API).
3. **All money is double-entry.** `LedgerService` posts balanced journals with idempotency keys; balances are derived, never stored.
4. **`packages/shared` is the protocol.** Client prediction and server authority import the same physics constants; API DTOs are Zod schemas used on both sides.
5. **Wallets are optional, always.** Guest → social login → (much later, opt-in) custodial Stellar account → (opt-in) Freighter self-custody.

## Phase status

| Phase | Scope | Status |
|---|---|---|
| 1 | Monorepo, auth, ledger, matchmaking tickets, RaceRoom, 3D scene | ✅ scaffolded |
| 2 | Rapier vehicle physics, drift/nitro, prediction+reconciliation, tracks | next |
| 3 | Matchmaking loop, garage, upgrades, betting (Credits), profiles | planned |
| 4 | Factions, districts, marketplace, treasuries | planned |
| 5 | Soroban testnet: escrow, registries, tournament pools, Freighter | escrow contract done |
| 6 | VFX/shaders/audio, anti-cheat re-sim, perf | planned |
| 7 | Observability, staging, testnet launch | planned |
