# marketplace-escrow

Soroban smart contract for atomic asset ↔ USDC settlement in Drift Protocol.

Full workspace docs (build/test/deploy commands, contract table) live one
level up at [`packages/contracts/README.md`](../README.md). This file
covers just this crate.

## Layout

| Path | Purpose |
|------|---------|
| `Cargo.toml` | Crate manifest — depends on `soroban-sdk` via the workspace |
| `src/lib.rs` | Contract implementation (`init`, `list`, `buy`, `cancel`, `get_listing`) |
| `src/test.rs` | 10 unit tests, run with `cargo test` from this directory or via `make test` |

`Cargo.lock` is not duplicated here — this crate is the sole member of the
Cargo workspace rooted at `packages/contracts/`, so the workspace-level
`Cargo.lock` (`../Cargo.lock`) is the single source of truth for resolved
dependency versions, per standard Cargo convention.

## Build & test this contract only

```bash
# from this directory
cargo test -- --nocapture
cargo build --target wasm32-unknown-unknown --release
```

Or via the local `Makefile` — see below.

## Public interface

Settlement-only escrow, no game logic on-chain. Full signatures, events,
and the `Listing` struct are documented in the workspace README; the
matching frontend TypeScript client lives at
[`apps/web/src/lib/contract.ts`](../../../apps/web/src/lib/contract.ts)
(see [`docs/CONTRACT_INTEGRATION.md`](../../../docs/CONTRACT_INTEGRATION.md)
for the function-by-function cross-reference).
