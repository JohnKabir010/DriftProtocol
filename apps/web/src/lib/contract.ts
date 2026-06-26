/**
 * Drift Protocol — Marketplace Escrow Soroban Contract Client
 *
 * Wraps the on-chain marketplace-escrow contract functions:
 *   get_listing · list · buy · cancel
 *
 * State-changing calls (list / buy / cancel) return an unsigned XDR string.
 * Callers must sign it with stellar-wallet.ts#signTx(), then submit with
 * submitContractTx().
 */

import {
  Contract,
  rpc,
  Transaction,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  nativeToScVal,
  Address,
  scValToNative,
} from "@stellar/stellar-sdk";

// ── Config ────────────────────────────────────────────────────────────────────

export const MARKETPLACE_CONTRACT_ID =
  process.env.NEXT_PUBLIC_MARKETPLACE_ESCROW_CONTRACT_ID ??
  "CBMBWHUDVNXT76B5I6WK753KY2CNH7ZIU26H57JS5ZBSWTKJH4DUW5RP";

const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  "https://soroban-testnet.stellar.org";

// ── Contract instance ─────────────────────────────────────────────────────────

export const escrowContract = new Contract(MARKETPLACE_CONTRACT_ID);

// ── Types matching the Rust struct ────────────────────────────────────────────

export interface OnChainListing {
  seller: string;
  assetContract: string;
  amount: bigint;
  priceUsdc: bigint;
  expiryLedger: number;
  active: boolean;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function getRpcServer(): rpc.Server {
  return new rpc.Server(SOROBAN_RPC_URL, { allowHttp: false });
}

async function buildBaseTx(
  callerAddress: string,
  operation: ReturnType<Contract["call"]>,
): Promise<Transaction> {
  const server = getRpcServer();
  const account = await server.getAccount(callerAddress);
  return new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();
}

// ── get_listing ───────────────────────────────────────────────────────────────

/**
 * Read-only simulation of get_listing — returns the live on-chain listing.
 * Matches contract function: `get_listing(env, listing_id: u64) -> Listing`
 */
export async function getListing(
  callerAddress: string,
  listingId: bigint,
): Promise<OnChainListing> {
  const server = getRpcServer();
  const tx = await buildBaseTx(
    callerAddress,
    escrowContract.call("get_listing", nativeToScVal(listingId, { type: "u64" })),
  );

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`get_listing simulation failed: ${sim.error}`);
  }

  const successSim = sim as rpc.Api.SimulateTransactionSuccessResponse;
  if (!successSim.result) throw new Error("get_listing: no result");

  const native = scValToNative(successSim.result.retval) as Record<string, unknown>;
  return {
    seller: native.seller as string,
    assetContract: native.asset_contract as string,
    amount: BigInt(native.amount as string | number | bigint),
    priceUsdc: BigInt(native.price_usdc as string | number | bigint),
    expiryLedger: Number(native.expiry_ledger),
    active: native.active as boolean,
  };
}

// ── list ──────────────────────────────────────────────────────────────────────

/**
 * Build XDR for `list(seller, asset_contract, amount, price_usdc, ttl_ledgers)`.
 * The caller must sign the returned XDR with signTx() and submit with submitContractTx().
 */
export async function buildListTx(
  sellerAddress: string,
  assetContractId: string,
  amount: bigint,
  priceUsdc: bigint,
  ttlLedgers: number,
): Promise<string> {
  const server = getRpcServer();
  const tx = await buildBaseTx(
    sellerAddress,
    escrowContract.call(
      "list",
      new Address(sellerAddress).toScVal(),
      new Address(assetContractId).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
      nativeToScVal(priceUsdc, { type: "i128" }),
      nativeToScVal(ttlLedgers, { type: "u32" }),
    ),
  );

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`list simulation failed: ${sim.error}`);
  }

  return rpc.assembleTransaction(
    tx,
    sim as rpc.Api.SimulateTransactionSuccessResponse,
  )
    .build()
    .toXDR();
}

// ── buy ───────────────────────────────────────────────────────────────────────

/**
 * Build XDR for `buy(buyer, listing_id)`.
 * Atomic swap: USDC to seller (minus fee) + asset to buyer in one Soroban tx.
 */
export async function buildBuyTx(
  buyerAddress: string,
  listingId: bigint,
): Promise<string> {
  const server = getRpcServer();
  const tx = await buildBaseTx(
    buyerAddress,
    escrowContract.call(
      "buy",
      new Address(buyerAddress).toScVal(),
      nativeToScVal(listingId, { type: "u64" }),
    ),
  );

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`buy simulation failed: ${sim.error}`);
  }

  return rpc.assembleTransaction(
    tx,
    sim as rpc.Api.SimulateTransactionSuccessResponse,
  )
    .build()
    .toXDR();
}

// ── cancel ────────────────────────────────────────────────────────────────────

/**
 * Build XDR for `cancel(listing_id)`.
 * Seller can cancel any time; anyone can trigger after expiry_ledger.
 */
export async function buildCancelTx(
  callerAddress: string,
  listingId: bigint,
): Promise<string> {
  const server = getRpcServer();
  const tx = await buildBaseTx(
    callerAddress,
    escrowContract.call(
      "cancel",
      nativeToScVal(listingId, { type: "u64" }),
    ),
  );

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`cancel simulation failed: ${sim.error}`);
  }

  return rpc.assembleTransaction(
    tx,
    sim as rpc.Api.SimulateTransactionSuccessResponse,
  )
    .build()
    .toXDR();
}

// ── submit ────────────────────────────────────────────────────────────────────

/**
 * Submit a signed Soroban transaction XDR to the network and poll for completion.
 */
export async function submitContractTx(signedXdr: string): Promise<{ hash: string }> {
  const server = getRpcServer();
  const tx = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
  const send = await server.sendTransaction(tx);

  if (send.status === "ERROR") {
    throw new Error(
      send.errorResult?.result().toString() ?? "Soroban tx send error",
    );
  }

  const final = await server.pollTransaction(send.hash, {
    attempts: 10,
    sleepStrategy: rpc.BasicSleepStrategy,
  });

  if (final.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Transaction ${send.hash} did not succeed (status: ${final.status})`);
  }

  return { hash: send.hash };
}
