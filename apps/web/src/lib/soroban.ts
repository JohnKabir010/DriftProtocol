/**
 * Drift Protocol — Soroban contract integration entry point.
 *
 * Re-exports the full marketplace-escrow Soroban client so UI components
 * import from a single, consistently named module.
 *
 * Contract functions (all match the on-chain Rust signatures):
 *   getListing(callerAddress, listingId)      → OnChainListing
 *   buildListTx(seller, assetContract, ...)   → XDR string (unsigned)
 *   buildBuyTx(buyer, listingId)              → XDR string (unsigned)
 *   buildCancelTx(caller, listingId)          → XDR string (unsigned)
 *   submitContractTx(signedXdr)               → { hash }
 *
 * Sign returned XDR strings with stellar-wallet.ts#signTx() before submitting.
 */

export {
  MARKETPLACE_CONTRACT_ID,
  escrowContract,
  getListing,
  buildListTx,
  buildBuyTx,
  buildCancelTx,
  submitContractTx,
} from "./contract";

export type { OnChainListing } from "./contract";
