import {
  isConnected,
  isAllowed,
  getAddress,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";

export const STELLAR_TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
export const HORIZON_TESTNET_URL = "https://horizon-testnet.stellar.org";

export async function detectFreighter(): Promise<boolean> {
  const result = await isConnected();
  return result.isConnected;
}

export async function connectWallet(): Promise<string> {
  const result = await requestAccess();
  if (result.error) throw new Error(result.error.message);
  if (!result.address) throw new Error("Freighter did not return an address");
  return result.address;
}

export async function getWalletAddress(): Promise<string | null> {
  const allowed = await isAllowed();
  if (!allowed.isAllowed) return null;
  const result = await getAddress();
  if (result.error || !result.address) return null;
  return result.address;
}

export async function signTx(xdr: string): Promise<string> {
  const result = await signTransaction(xdr, {
    networkPassphrase: STELLAR_TESTNET_PASSPHRASE,
  });
  if (result.error) throw new Error(result.error.message);
  return result.signedTxXdr;
}
