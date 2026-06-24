"use client";

import { StellarWalletPanel } from "@/components/wallet/stellar-wallet-panel";

export default function WalletPage() {
  return (
    <main className="min-h-screen pt-24 px-6 pb-10">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-3xl tracking-widest text-neon-cyan">
            STELLAR WALLET
          </h1>
          <p className="text-white/40 text-sm mt-1 font-display tracking-wide">
            Freighter Integration — Stellar TESTNET
          </p>
        </div>

        {/* Badge row */}
        <div className="flex flex-wrap gap-2">
          <span className="font-display text-[10px] px-2 py-1 border border-neon-cyan/30 text-neon-cyan/60 tracking-widest">
            NETWORK: TESTNET
          </span>
          <span className="font-display text-[10px] px-2 py-1 border border-white/10 text-white/30 tracking-widest">
            HORIZON: horizon-testnet.stellar.org
          </span>
          <span className="font-display text-[10px] px-2 py-1 border border-white/10 text-white/30 tracking-widest">
            PASSPHRASE: Test SDF Network ; September 2015
          </span>
        </div>

        {/* Wallet panel — all requirements in one component */}
        <StellarWalletPanel />

        <div className="font-display text-[10px] text-white/20 text-center tracking-widest pt-4">
          ALL TRANSACTIONS TARGET STELLAR TESTNET — NO REAL FUNDS
        </div>
      </div>
    </main>
  );
}
