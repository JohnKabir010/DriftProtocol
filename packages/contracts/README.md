# Drift Protocol — Soroban Smart Contracts

Soroban (Stellar) contracts for the Drift Protocol on-chain economy.

## Contracts

| Contract | Path | Description |
|----------|------|-------------|
| `marketplace-escrow` | `marketplace-escrow/` | Atomic asset ↔ USDC settlement for in-game items |

## Quick start

```bash
# Build all contracts to WASM
make build

# Run all unit tests
make test

# Deploy to testnet (requires stellar CLI + STELLAR_DEPLOY_KEY env var)
make deploy NETWORK=testnet
```

Requires: Rust stable + `wasm32-unknown-unknown` target + [stellar CLI](https://github.com/stellar/stellar-cli).

```bash
rustup target add wasm32-unknown-unknown
cargo install --locked stellar-cli
```

---

## `marketplace-escrow`

**Source:** `marketplace-escrow/src/lib.rs`  
**Tests:** `marketplace-escrow/src/test.rs` (10 tests, all passing)

Settlement-only escrow — no game logic on-chain. A seller escrows a registry token; a buyer fills with USDC; the swap is atomic. There is no admin withdrawal path: funds can only flow to buyer, seller, or back to seller on cancel/expiry.

### Public functions

| Function | Inputs | Description |
|----------|--------|-------------|
| `init(usdc, fee_recipient, fee_bps)` | `Address, Address, u32` | One-time initialisation. Fee capped at 500 bps (5%). |
| `list(seller, asset_contract, amount, price_usdc, ttl_ledgers)` | `Address, Address, i128, i128, u32` | Seller escrows asset and opens a listing. Returns `listing_id: u64`. |
| `buy(buyer, listing_id)` | `Address, u64` | Atomic swap: USDC→seller (minus fee), asset→buyer. |
| `cancel(listing_id)` | `u64` | Seller cancels any time; anyone may sweep after expiry. |
| `get_listing(listing_id)` | `u64` | Read-only view returning the `Listing` struct. |

### Events

Every state change emits a Soroban event for off-chain indexers:

| Topic | Data |
|-------|------|
| `("escrow", "listed")` | `(listing_id: u64, seller: Address, price_usdc: i128)` |
| `("escrow", "sold")` | `(listing_id: u64, buyer: Address, price_usdc: i128)` |
| `("escrow", "canceld")` | `(listing_id: u64, seller: Address, expired: bool)` |

### Listing struct

```rust
pub struct Listing {
    pub seller: Address,
    pub asset_contract: Address,  // SEP-41 token for the escrowed item
    pub amount: i128,
    pub price_usdc: i128,
    pub expiry_ledger: u32,
    pub active: bool,
}
```

### Fee model

- Fee is set at `init` time in basis points (1 bps = 0.01%).
- Hard-capped at **500 bps (5%)** — enforced in contract, cannot be changed post-deploy.
- Fee flows to `fee_recipient` on every successful `buy`.

### Frontend integration

The TypeScript client for this contract lives at:

- **`apps/web/src/lib/contract.ts`** — Soroban RPC client wrapping `get_listing`, `list`, `buy`, `cancel`
- **`apps/web/src/lib/soroban.ts`** — Re-export entry point (use this in UI components)
- **`apps/web/src/lib/stellar-sdk.ts`** — Horizon helpers: balance fetch, XLM payment builder, tx submit
- **`apps/web/src/lib/stellar-wallet.ts`** — Freighter wallet connector: connect, sign transactions

Contract ID (testnet): `CBMBWHUDVNXT76B5I6WK753KY2CNH7ZIU26H57JS5ZBSWTKJH4DUW5RP`

### Deployed contract ID

Set `NEXT_PUBLIC_MARKETPLACE_ESCROW_CONTRACT_ID` in the web app environment to point at the live contract.

---

## Test coverage

```
marketplace_escrow::test::list_and_buy_settles_atomically   ok
marketplace_escrow::test::cannot_double_buy                  ok
marketplace_escrow::test::seller_can_cancel_before_expiry    ok
marketplace_escrow::test::expiry_refund_after_ttl            ok
marketplace_escrow::test::cannot_reinitialize                ok
marketplace_escrow::test::fee_cap_enforced                   ok
marketplace_escrow::test::zero_amount_rejected               ok
marketplace_escrow::test::events_emitted_on_list_and_buy     ok
marketplace_escrow::test::get_listing_returns_active_listing ok
marketplace_escrow::test::get_listing_inactive_after_buy     ok
```

Run with: `make test`
