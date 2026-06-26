import * as StellarSdk from "@stellar/stellar-sdk";
import {
  Horizon,
  Networks,
  TransactionBuilder,
  Operation,
  Asset,
  BASE_FEE,
} from "@stellar/stellar-sdk";

export { StellarSdk };

const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";

export const networkPassphrase =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ?? Networks.TESTNET;

export const server = new StellarSdk.rpc.Server(SOROBAN_RPC_URL, { allowHttp: false });

import { HORIZON_TESTNET_URL, STELLAR_TESTNET_PASSPHRASE } from "./stellar-wallet";

function getServer(): Horizon.Server {
  return new Horizon.Server(HORIZON_TESTNET_URL);
}

export async function fetchXlmBalance(address: string): Promise<string> {
  const server = getServer();
  try {
    const account = await server.loadAccount(address);
    const native = account.balances.find(
      (b) => b.asset_type === "native"
    );
    return native?.balance ?? "0";
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      "response" in err &&
      (err as { response?: { status?: number } }).response?.status === 404
    ) {
      throw new Error("ACCOUNT_NOT_FOUND");
    }
    throw err;
  }
}

export async function buildPaymentXdr(
  from: string,
  to: string,
  amount: string
): Promise<string> {
  const server = getServer();
  const account = await server.loadAccount(from);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination: to,
        asset: Asset.native(),
        amount,
      })
    )
    .setTimeout(30)
    .build();
  return tx.toXDR();
}

export async function submitSignedTx(
  signedXdr: string
): Promise<{ hash: string }> {
  const server = getServer();
  const tx = TransactionBuilder.fromXDR(signedXdr, STELLAR_TESTNET_PASSPHRASE);
  const result = await server.submitTransaction(tx);
  return { hash: result.hash };
}
