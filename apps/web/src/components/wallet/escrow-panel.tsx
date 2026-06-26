"use client";

import { useState } from "react";
import {
  MARKETPLACE_CONTRACT_ID,
  getListing,
  buildBuyTx,
  buildCancelTx,
  type OnChainListing,
} from "@/lib/contract";
import { signTx } from "@/lib/stellar-wallet";
import { submitContractTx } from "@/lib/contract";
import { HoloCard } from "@/components/ui/HoloCard";
import { NeonButton } from "@/components/ui/NeonButton";

function truncate(s: string, n = 8) {
  return s.length > n * 2 + 1 ? `${s.slice(0, n)}…${s.slice(-n)}` : s;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-xs">
      <span className="font-display text-white/30 tracking-widest">{label}</span>
      <span className="font-mono text-neon-cyan/80 text-right break-all">{value}</span>
    </div>
  );
}

interface Props {
  walletAddress: string | null;
}

export function EscrowPanel({ walletAddress }: Props) {
  const [listingId, setListingId] = useState("");
  const [listing, setListing] = useState<OnChainListing | null>(null);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [txLoading, setTxLoading] = useState(false);
  const [txResult, setTxResult] = useState<{ kind: "success" | "error"; message: string; hash?: string } | null>(null);

  async function fetchListing() {
    if (!walletAddress || !listingId) return;
    setFetchLoading(true);
    setFetchError(null);
    setListing(null);
    try {
      const id = BigInt(listingId);
      const result = await getListing(walletAddress, id);
      setListing(result);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to fetch listing");
    } finally {
      setFetchLoading(false);
    }
  }

  async function executeTx(buildFn: () => Promise<string>) {
    if (!walletAddress) return;
    setTxLoading(true);
    setTxResult(null);
    try {
      const xdr = await buildFn();
      const signedXdr = await signTx(xdr);
      const { hash } = await submitContractTx(signedXdr);
      setTxResult({ kind: "success", message: "Transaction confirmed!", hash });
      // Refresh listing after successful tx
      if (listingId && walletAddress) {
        await getListing(walletAddress, BigInt(listingId)).then(setListing).catch(() => {});
      }
    } catch (err) {
      setTxResult({
        kind: "error",
        message: err instanceof Error ? err.message : "Transaction failed",
      });
    } finally {
      setTxLoading(false);
    }
  }

  const canInteract = !!walletAddress && !!listingId && listing?.active;

  return (
    <HoloCard className="p-6 space-y-5">
      {/* Header */}
      <div>
        <div className="font-display text-sm text-white tracking-widest">
          ON-CHAIN ESCROW
        </div>
        <p className="text-white/30 text-xs mt-1">
          Contract{" "}
          <code className="font-mono text-neon-cyan/50">{truncate(MARKETPLACE_CONTRACT_ID, 6)}</code>
          {" "}· Stellar Testnet
        </p>
      </div>

      {/* Lookup */}
      <div className="space-y-2">
        <label className="font-display text-[10px] text-white/40 tracking-widest">
          LISTING ID
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            value={listingId}
            onChange={(e) => {
              setListingId(e.target.value);
              setListing(null);
              setFetchError(null);
              setTxResult(null);
            }}
            placeholder="0"
            className="flex-1 bg-white/5 border border-neon-cyan/20 text-neon-volt font-display text-sm px-3 py-2 focus:outline-none focus:border-neon-cyan/50"
          />
          <NeonButton
            variant="cyan"
            size="sm"
            onClick={fetchListing}
            disabled={fetchLoading || !walletAddress || !listingId}
          >
            {fetchLoading ? "LOADING…" : "GET LISTING"}
          </NeonButton>
        </div>
        {!walletAddress && (
          <p className="text-white/30 text-[10px] font-display tracking-widest">
            Connect wallet above to query the contract.
          </p>
        )}
        {fetchError && (
          <p className="text-red-400 text-xs font-mono break-all">{fetchError}</p>
        )}
      </div>

      {/* Listing data */}
      {listing && (
        <div className="border border-neon-cyan/20 p-4 space-y-2">
          <div className="font-display text-[10px] text-neon-cyan/60 tracking-widest mb-3">
            LISTING #{listingId}
          </div>
          <Row label="SELLER" value={truncate(listing.seller)} />
          <Row label="ASSET CONTRACT" value={truncate(listing.assetContract)} />
          <Row label="AMOUNT" value={listing.amount.toString()} />
          <Row label="PRICE USDC (stroops)" value={listing.priceUsdc.toString()} />
          <Row label="EXPIRY LEDGER" value={listing.expiryLedger.toString()} />
          <Row
            label="STATUS"
            value={
              <span className={listing.active ? "text-neon-volt" : "text-white/30"}>
                {listing.active ? "ACTIVE" : "CLOSED"}
              </span>
            }
          />
        </div>
      )}

      {/* Actions */}
      {listing?.active && (
        <div className="flex gap-3 pt-1">
          {walletAddress !== listing.seller && (
            <NeonButton
              variant="volt"
              size="sm"
              disabled={!canInteract || txLoading}
              onClick={() =>
                executeTx(() => buildBuyTx(walletAddress!, BigInt(listingId)))
              }
            >
              {txLoading ? "SIGNING…" : "BUY (ON-CHAIN)"}
            </NeonButton>
          )}
          {walletAddress === listing.seller && (
            <NeonButton
              variant="magenta"
              size="sm"
              disabled={!canInteract || txLoading}
              onClick={() =>
                executeTx(() => buildCancelTx(walletAddress!, BigInt(listingId)))
              }
            >
              {txLoading ? "SIGNING…" : "CANCEL LISTING"}
            </NeonButton>
          )}
        </div>
      )}

      {/* Tx result */}
      {txResult && (
        <div
          className={`p-3 border text-xs font-mono break-all ${
            txResult.kind === "success"
              ? "border-neon-volt/40 bg-neon-volt/10 text-neon-volt"
              : "border-red-500/40 bg-red-500/10 text-red-400"
          }`}
        >
          {txResult.kind === "success" && txResult.hash ? (
            <>
              {txResult.message} Hash:{" "}
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${txResult.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white transition-colors"
              >
                {txResult.hash}
              </a>
            </>
          ) : (
            txResult.message
          )}
        </div>
      )}
    </HoloCard>
  );
}
