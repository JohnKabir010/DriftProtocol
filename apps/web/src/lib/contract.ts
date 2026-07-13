/**
 * Drift Protocol — Marketplace Escrow Soroban Contract Client
 *
 * Wraps the on-chain marketplace-escrow contract functions:
 *   init · get_listing · list · buy · cancel
 *
 * State-changing calls (init / list / buy / cancel) return an unsigned XDR string.
 * Callers must sign it with stellar-wallet.ts#signTx(), then submit with
 * submitContractTx().
 *
 * callContractFunction() is a generic helper that builds, simulates, signs
 * (with a raw secret key), and submits a contract call in one shot.
 */

import {
  Contract,
  rpc,
  Transaction,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  Address,
  scValToNative,
  Keypair,
} from "@stellar/stellar-sdk";
import { server, networkPassphrase } from "./stellar-sdk";

// ── Config ────────────────────────────────────────────────────────────────────

export const MARKETPLACE_CONTRACT_ID =
  process.env.NEXT_PUBLIC_MARKETPLACE_ESCROW_CONTRACT_ID ??
  "CBMBWHUDVNXT76B5I6WK753KY2CNH7ZIU26H57JS5ZBSWTKJH4DUW5RP";

export const CONTRACT_ID = MARKETPLACE_CONTRACT_ID;

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

async function buildBaseTx(
  callerAddress: string,
  operation: ReturnType<Contract["call"]>,
): Promise<Transaction> {
  const account = await server.getAccount(callerAddress);
  return new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();
}

// ── Generic contract caller ───────────────────────────────────────────────────

/**
 * Build, simulate, sign (with signerSecret), and submit any contract call.
 * Returns the native-decoded return value, or undefined for void functions.
 */
export async function callContractFunction(
  contractId: string,
  method: string,
  args: ReturnType<typeof nativeToScVal>[],
  signerSecret: string,
): Promise<ReturnType<typeof scValToNative> | undefined> {
  const keypair = Keypair.fromSecret(signerSecret);
  const account = await server.getAccount(keypair.publicKey());
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }

  const assembled = rpc
    .assembleTransaction(tx, sim as rpc.Api.SimulateTransactionSuccessResponse)
    .build();
  assembled.sign(keypair);

  const send = await server.sendTransaction(assembled);
  if (send.status === "ERROR") {
    throw new Error(send.errorResult?.result().toString() ?? "Send error");
  }

  const final = await server.pollTransaction(send.hash, {
    attempts: 10,
    sleepStrategy: rpc.BasicSleepStrategy,
  });

  if (final.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Transaction failed (status: ${final.status})`);
  }

  if (final.returnValue != null) {
    return scValToNative(final.returnValue);
  }
  return undefined;
}

// ── init ──────────────────────────────────────────────────────────────────────

/**
 * Build XDR for `init(usdc, fee_recipient, fee_bps)`.
 * One-time contract initialisation — must be called by the deployer.
 */
export async function buildInitTx(
  callerAddress: string,
  usdc: string,
  feeRecipient: string,
  feeBps: number,
): Promise<string> {
  const tx = await buildBaseTx(
    callerAddress,
    escrowContract.call(
      "init",
      new Address(usdc).toScVal(),
      new Address(feeRecipient).toScVal(),
      nativeToScVal(feeBps, { type: "u32" }),
    ),
  );

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`init simulation failed: ${sim.error}`);
  }

  return rpc
    .assembleTransaction(tx, sim as rpc.Api.SimulateTransactionSuccessResponse)
    .build()
    .toXDR();
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

  return rpc
    .assembleTransaction(tx, sim as rpc.Api.SimulateTransactionSuccessResponse)
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

  return rpc
    .assembleTransaction(tx, sim as rpc.Api.SimulateTransactionSuccessResponse)
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

  return rpc
    .assembleTransaction(tx, sim as rpc.Api.SimulateTransactionSuccessResponse)
    .build()
    .toXDR();
}

// ── submit ────────────────────────────────────────────────────────────────────

/**
 * Submit a signed Soroban transaction XDR to the network and poll for completion.
 */
export async function submitContractTx(signedXdr: string): Promise<{ hash: string }> {
  const tx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
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
