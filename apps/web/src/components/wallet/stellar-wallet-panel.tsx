"use client";

import { useState, useEffect } from "react";
import {
  detectFreighter,
  connectWallet,
  signTx,
} from "@/lib/stellar-wallet";
import { fetchXlmBalance, buildPaymentXdr, submitSignedTx } from "@/lib/stellar-sdk";
import { HoloCard } from "@/components/ui/HoloCard";
import { NeonButton } from "@/components/ui/NeonButton";

// ── tiny helpers ──────────────────────────────────────────────────────────────

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`;
}

function Spinner() {
  return (
    <span className="inline-block w-3 h-3 border-2 border-neon-cyan/40 border-t-neon-cyan rounded-full animate-spin" />
  );
}

function Banner({
  kind,
  children,
}: {
  kind: "success" | "error";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`p-3 border text-xs font-mono break-all ${
        kind === "success"
          ? "border-neon-volt/40 bg-neon-volt/10 text-neon-volt"
          : "border-red-500/40 bg-red-500/10 text-red-400"
      }`}
    >
      {children}
    </div>
  );
}

// ── sub-panels ────────────────────────────────────────────────────────────────

function InstallPrompt() {
  return (
    <HoloCard className="p-8 text-center space-y-4" glow="magenta">
      <div className="font-display text-2xl text-neon-magenta">FREIGHTER NOT DETECTED</div>
      <p className="text-white/50 text-sm">
        Install the Freighter browser extension to interact with the Stellar network.
      </p>
      <a
        href="https://freighter.app"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block font-display text-sm tracking-widest px-6 py-3 border border-neon-cyan/40 text-neon-cyan hover:border-neon-cyan/80 hover:bg-neon-cyan/10 transition-all"
      >
        INSTALL FREIGHTER →
      </a>
      <p className="text-white/20 text-xs">
        After installing, refresh this page.
      </p>
    </HoloCard>
  );
}

function ConnectPrompt({
  onConnect,
  loading,
  error,
}: {
  onConnect: () => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <HoloCard className="p-8 text-center space-y-5" glow="cyan">
      <div className="font-display text-2xl text-neon-cyan">CONNECT WALLET</div>
      <p className="text-white/50 text-sm">
        Connect your Freighter wallet to view your balance and send XLM on Stellar Testnet.
      </p>
      {error && <Banner kind="error">{error}</Banner>}
      <NeonButton variant="cyan" size="lg" onClick={onConnect} disabled={loading}>
        {loading ? (
          <span className="flex items-center gap-2">
            <Spinner /> CONNECTING…
          </span>
        ) : (
          "CONNECT WALLET"
        )}
      </NeonButton>
      <p className="text-white/20 text-[10px] tracking-widest">
        STELLAR TESTNET · horizon-testnet.stellar.org
      </p>
    </HoloCard>
  );
}

function BalancePanel({
  address,
  balance,
  loading,
  onRefresh,
  onDisconnect,
}: {
  address: string;
  balance: string | null;
  loading: boolean;
  onRefresh: () => void;
  onDisconnect: () => void;
}) {
  const displayBalance =
    balance === null
      ? "—"
      : balance === "NOT_FUNDED"
      ? "0 XLM (account not funded)"
      : `${balance} XLM`;

  return (
    <HoloCard className="p-6 space-y-4" glow="cyan">
      {/* Address row */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-display text-[10px] text-white/30 tracking-widest mb-1">
            CONNECTED ADDRESS
          </div>
          <code className="font-mono text-xs text-neon-cyan/80 break-all">{address}</code>
          <div className="font-display text-[10px] text-white/20 mt-0.5">
            ({truncate(address)})
          </div>
        </div>
        <NeonButton variant="magenta" size="sm" onClick={onDisconnect}>
          DISCONNECT
        </NeonButton>
      </div>

      {/* Balance row */}
      <div className="border-t border-white/5 pt-4 flex items-center justify-between">
        <div>
          <div className="font-display text-[10px] text-white/30 tracking-widest mb-1">
            XLM BALANCE (TESTNET)
          </div>
          <div className="font-display text-3xl text-neon-volt">
            {loading ? <Spinner /> : displayBalance}
          </div>
        </div>
        <NeonButton variant="volt" size="sm" onClick={onRefresh} disabled={loading}>
          {loading ? "REFRESHING…" : "REFRESH BALANCE"}
        </NeonButton>
      </div>
    </HoloCard>
  );
}

interface TxResult {
  kind: "success" | "error";
  message: string;
  hash?: string;
}

function SendForm({
  address,
  loading,
  onSend,
}: {
  address: string;
  loading: boolean;
  onSend: (to: string, amount: string) => Promise<TxResult>;
}) {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<TxResult | null>(null);

  async function handleSend() {
    if (!to || !amount) return;
    setSending(true);
    setResult(null);
    const outcome = await onSend(to, amount);
    setResult(outcome);
    if (outcome.kind === "success") {
      setTo("");
      setAmount("");
    }
    setSending(false);
  }

  const busy = sending || loading;

  return (
    <HoloCard className="p-6 space-y-5">
      <div className="font-display text-sm text-white tracking-widest">SEND XLM</div>
      <p className="text-white/30 text-xs">
        Send XLM on Stellar Testnet from{" "}
        <span className="text-neon-cyan/60 font-mono">{truncate(address)}</span>
      </p>

      <div className="space-y-3">
        <div>
          <label className="font-display text-[10px] text-white/40 tracking-widest">
            DESTINATION ADDRESS (G…)
          </label>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="GABC…"
            className="mt-1 w-full bg-white/5 border border-neon-cyan/20 text-white font-mono text-xs px-3 py-2 focus:outline-none focus:border-neon-cyan/50"
          />
        </div>
        <div>
          <label className="font-display text-[10px] text-white/40 tracking-widest">
            AMOUNT (XLM)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1.0000000"
            min="0.0000001"
            step="0.0000001"
            className="mt-1 w-full bg-white/5 border border-neon-cyan/20 text-neon-volt font-display text-sm px-3 py-2 focus:outline-none focus:border-neon-volt/50"
          />
        </div>
      </div>

      {result && (
        <Banner kind={result.kind}>
          {result.kind === "success" && result.hash ? (
            <>
              Transaction sent! Hash:{" "}
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${result.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white transition-colors"
              >
                {result.hash}
              </a>
            </>
          ) : (
            result.message
          )}
        </Banner>
      )}

      <NeonButton
        variant="cyan"
        onClick={handleSend}
        disabled={busy || !to || !amount}
      >
        {busy ? (
          <span className="flex items-center gap-2">
            <Spinner />
            {sending ? "SIGNING & SUBMITTING…" : "PROCESSING…"}
          </span>
        ) : (
          "SEND XLM"
        )}
      </NeonButton>
    </HoloCard>
  );
}

// ── main panel ────────────────────────────────────────────────────────────────

export function StellarWalletPanel() {
  const [hasFreighter, setHasFreighter] = useState<boolean | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Detect Freighter on mount
  useEffect(() => {
    detectFreighter()
      .then(setHasFreighter)
      .catch(() => setHasFreighter(false));
  }, []);

  async function handleConnect() {
    setConnecting(true);
    setConnectError(null);
    try {
      const addr = await connectWallet();
      setAddress(addr);
      await loadBalance(addr);
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  }

  async function loadBalance(addr: string) {
    setBalanceLoading(true);
    try {
      const bal = await fetchXlmBalance(addr);
      setBalance(bal);
    } catch (err) {
      if (err instanceof Error && err.message === "ACCOUNT_NOT_FOUND") {
        setBalance("NOT_FUNDED");
      } else {
        setBalance(null);
      }
    } finally {
      setBalanceLoading(false);
    }
  }

  function handleDisconnect() {
    setAddress(null);
    setBalance(null);
    setConnectError(null);
  }

  async function handleRefreshBalance() {
    if (!address) return;
    await loadBalance(address);
  }

  async function handleSend(to: string, amount: string): Promise<TxResult> {
    if (!address) return { kind: "error", message: "Wallet not connected" };
    try {
      const xdr = await buildPaymentXdr(address, to, amount);
      const signedXdr = await signTx(xdr);
      const { hash } = await submitSignedTx(signedXdr);
      await loadBalance(address);
      return { kind: "success", message: "Transaction sent!", hash };
    } catch (err) {
      let message = "Transaction failed";
      if (err instanceof Error) {
        message = err.message;
      }
      // Horizon errors sometimes nest extras
      const horizonErr = err as { response?: { data?: { extras?: { result_codes?: unknown } } } };
      if (horizonErr?.response?.data?.extras?.result_codes) {
        message = JSON.stringify(horizonErr.response.data.extras.result_codes);
      }
      return { kind: "error", message };
    }
  }

  // Still detecting
  if (hasFreighter === null) {
    return (
      <div className="flex items-center justify-center py-20 text-white/40 font-display text-sm tracking-widest">
        <Spinner /> <span className="ml-3">DETECTING FREIGHTER…</span>
      </div>
    );
  }

  if (!hasFreighter) {
    return <InstallPrompt />;
  }

  if (!address) {
    return (
      <ConnectPrompt
        onConnect={handleConnect}
        loading={connecting}
        error={connectError}
      />
    );
  }

  return (
    <div className="space-y-4">
      <BalancePanel
        address={address}
        balance={balance}
        loading={balanceLoading}
        onRefresh={handleRefreshBalance}
        onDisconnect={handleDisconnect}
      />
      <SendForm
        address={address}
        loading={balanceLoading}
        onSend={handleSend}
      />
    </div>
  );
}
