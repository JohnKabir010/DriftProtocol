"use client";

import { useState, useCallback } from "react";
import {
  detectFreighter,
  connectWallet,
  getWalletAddress,
  signTx,
} from "@/lib/stellar-wallet";
import {
  fetchXlmBalance,
  buildPaymentXdr,
  submitSignedTx,
} from "@/lib/stellar-sdk";

interface WalletState {
  address: string | null;
  balance: string | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

interface UseWalletReturn extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  sendXlm: (to: string, amount: string) => Promise<{ hash: string }>;
}

export function useWallet(): UseWalletReturn {
  const [state, setState] = useState<WalletState>({
    address: null,
    balance: null,
    isConnected: false,
    isLoading: false,
    error: null,
  });

  const setError = (error: string | null) =>
    setState((s) => ({ ...s, error, isLoading: false }));

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const detected = await detectFreighter();
      if (!detected) {
        throw new Error("Freighter extension not found. Please install it.");
      }
      const address = await connectWallet();
      let balance: string | null = null;
      try {
        balance = await fetchXlmBalance(address);
      } catch {
        balance = null;
      }
      setState({ address, balance, isConnected: true, isLoading: false, error: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect wallet");
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({ address: null, balance: null, isConnected: false, isLoading: false, error: null });
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!state.address) return;
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const balance = await fetchXlmBalance(state.address);
      setState((s) => ({ ...s, balance, isLoading: false }));
    } catch (err) {
      if (err instanceof Error && err.message === "ACCOUNT_NOT_FOUND") {
        setState((s) => ({ ...s, balance: "NOT_FUNDED", isLoading: false }));
      } else {
        setError(err instanceof Error ? err.message : "Failed to fetch balance");
      }
    }
  }, [state.address]);

  const sendXlm = useCallback(
    async (to: string, amount: string): Promise<{ hash: string }> => {
      if (!state.address) throw new Error("Wallet not connected");
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const xdr = await buildPaymentXdr(state.address, to, amount);
        const signedXdr = await signTx(xdr);
        const result = await submitSignedTx(signedXdr);
        await refreshBalance();
        setState((s) => ({ ...s, isLoading: false }));
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Transaction failed";
        setError(msg);
        throw new Error(msg);
      }
    },
    [state.address, refreshBalance]
  );

  return { ...state, connect, disconnect, refreshBalance, sendXlm };
}
