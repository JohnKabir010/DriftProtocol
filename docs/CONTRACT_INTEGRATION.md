# Contract ↔ Frontend Integration Cross-Reference

Explicit mapping of every public function on the `marketplace-escrow`
Soroban contract to its frontend TypeScript counterpart, so contract and
client can be verified against each other function-by-function.

Contract source: [`packages/contracts/marketplace-escrow/src/lib.rs`](../packages/contracts/marketplace-escrow/src/lib.rs)
Frontend client: [`apps/web/src/lib/contract.ts`](../apps/web/src/lib/contract.ts)
Re-export entry point: [`apps/web/src/lib/soroban.ts`](../apps/web/src/lib/soroban.ts)

| Rust function (`lib.rs`) | Signature | TypeScript wrapper (`contract.ts`) | Returns |
|---|---|---|---|
| `init` | `(env, usdc: Address, fee_recipient: Address, fee_bps: u32)` | `buildInitTx(callerAddress, usdc, feeRecipient, feeBps)` | unsigned XDR string |
| `list` | `(env, seller, asset_contract, amount: i128, price_usdc: i128, ttl_ledgers: u32) -> u64` | `buildListTx(sellerAddress, assetContractId, amount, priceUsdc, ttlLedgers)` | unsigned XDR string |
| `buy` | `(env, buyer: Address, listing_id: u64)` | `buildBuyTx(buyerAddress, listingId)` | unsigned XDR string |
| `cancel` | `(env, listing_id: u64)` | `buildCancelTx(callerAddress, listingId)` | unsigned XDR string |
| `get_listing` | `(env, listing_id: u64) -> Listing` | `getListing(callerAddress, listingId)` | `OnChainListing` (decoded) |
| n/a — generic dispatch | any method | `callContractFunction(contractId, method, args, signerSecret)` | build → simulate → sign → submit in one call |

State-changing calls (`init`/`list`/`buy`/`cancel`) build and simulate a
transaction and return unsigned XDR; the caller signs it via
`stellar-wallet.ts#signTx()` and submits with `submitContractTx()` from
`contract.ts`. `get_listing` is a read-only simulation with no signing
step.

The `Listing` struct returned by `get_listing` maps 1:1 onto
`OnChainListing` in `contract.ts` (`seller`, `asset_contract` →
`assetContract`, `amount`, `price_usdc` → `priceUsdc`, `expiry_ledger` →
`expiryLedger`, `active`).

Contract ID wiring: `NEXT_PUBLIC_MARKETPLACE_ESCROW_CONTRACT_ID` (frontend
build env) must match the ID returned by `stellar contract deploy` in
CI/CD — see [`.github/workflows/deploy-staging.yml`](../.github/workflows/deploy-staging.yml)
and [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).
