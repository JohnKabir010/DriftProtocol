"use client";

import type { MatchTicket } from "@drift/shared";
import { useSessionStore } from "@/stores/sessionStore";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useSessionStore.getState().accessToken;
  const res = await fetch(`${BASE}/v1${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
    body: init.body ? (typeof init.body === "string" ? init.body : JSON.stringify(init.body)) : undefined,
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  auth: {
    guest: () => request<{ accessToken: string }>("/auth/guest", { method: "POST" }),
  },
  players: {
    me: () => request<import("@/stores/sessionStore").PlayerProfile>("/players/me"),
    get: (id: string) => request<import("@/stores/sessionStore").PlayerProfile>(`/players/${id}`),
    leaderboard: () => request<LeaderboardRow[]>("/players/leaderboard"),
  },
  garage: {
    cars: () => request<CarWithUpgrades[]>("/garage/cars"),
    upgrade: (carId: string, slot: string) =>
      request<{ ok: true }>(`/garage/cars/${carId}/upgrade`, { method: "POST", body: JSON.stringify({ slot }) }),
    livery: (carId: string, livery: Record<string, unknown>) =>
      request<{ ok: true }>(`/garage/cars/${carId}/livery`, { method: "POST", body: JSON.stringify(livery) }),
  },
  matchmaking: {
    queue: (mode: string, carClass: string) =>
      request<{ queued: true }>("/matchmaking/queue", { method: "POST", body: JSON.stringify({ mode, carClass }) }),
    poll: () => request<MatchTicket | { waiting: true }>("/matchmaking/ticket"),
    quick: (mode: string, carClass: string) =>
      request<MatchTicket>("/matchmaking/quick", { method: "POST", body: JSON.stringify({ mode, carClass }) }),
    botRace: (trackId: string, difficulty: "easy" | "medium" | "hard") =>
      request<MatchTicket>("/matchmaking/bot-race", { method: "POST", body: JSON.stringify({ trackId, difficulty }) }),
  },
  factions: {
    list: () => request<FactionSummary[]>("/factions"),
    get: (id: string) => request<FactionDetail>(`/factions/${id}`),
    me: () => request<{ faction: FactionSummary; rank: string } | null>("/factions/me"),
    create: (name: string, tag: string) =>
      request<{ id: string }>("/factions", { method: "POST", body: JSON.stringify({ name, tag }) }),
    join: (id: string) => request<{ ok: true }>(`/factions/${id}/join`, { method: "POST" }),
    leave: () => request<{ ok: true }>("/factions/leave", { method: "DELETE" }),
  },
  districts: {
    list: () => request<DistrictSummary[]>("/districts"),
    get: (key: string) => request<DistrictDetail>(`/districts/${key}`),
  },
  market: {
    browse: (cursor?: string) => request<MarketListingRow[]>(`/market${cursor ? `?cursor=${cursor}` : ""}`),
    mine: () => request<MarketListingRow[]>("/market/mine"),
    list: (carId: string, price: number) =>
      request<{ id: string }>("/market", { method: "POST", body: JSON.stringify({ carId, price }) }),
    buy: (id: string) => request<{ ok: true }>(`/market/${id}/buy`, { method: "POST" }),
    cancel: (id: string) => request<{ ok: true }>(`/market/${id}`, { method: "DELETE" }),
  },
  wallet: {
    get: () => request<WalletInfo>("/wallet"),
    balances: () => request<{ credits: string; usdc: string; custodialAddress: string }>("/wallet/balances"),
    challenge: () => request<{ challenge: string }>("/wallet/challenge"),
    link: (publicKey: string, challenge: string, signature: string) =>
      request<{ ok: true }>("/wallet/link", { method: "POST", body: JSON.stringify({ publicKey, challenge, signature }) }),
    unlink: (id: string) => request<{ ok: true }>(`/wallet/link/${id}`, { method: "DELETE" }),
    withdraw: (toAddress: string, amount: string) =>
      request<{ txHash: string; status: "CONFIRMED" | "SETTLING" }>("/wallet/withdraw", {
        method: "POST",
        body: JSON.stringify({ toAddress, amount }),
      }),
    airdrop: () => request<{ txHash: string; amount: string; address: string }>("/wallet/airdrop", { method: "POST" }),
  },
  dev: {
    boost: () => request<import("@/stores/sessionStore").PlayerProfile>("/players/me/dev-boost", { method: "POST" }),
  },
  betting: {
    open: () => request<BetPoolRow[]>("/betting/open"),
    mine: () => request<MyBetRow[]>("/betting/mine"),
    place: (poolId: string, selectionId: string, stake: number) =>
      request<{ ok: true; betId: string }>(`/betting/pools/${poolId}/bets`, {
        method: "POST",
        body: JSON.stringify({ selectionId, stake }),
      }),
  },
  tournaments: {
    list: () => request<TournamentRow[]>("/tournaments"),
    get: (id: string) => request<TournamentRow>(`/tournaments/${id}`),
    create: (body: { name: string; mode: string; entryFee: number; bracketSize: number; startsAt: string }) =>
      request<{ id: string }>("/tournaments", { method: "POST", body: JSON.stringify(body) }),
    register: (id: string) => request<{ ok: true }>(`/tournaments/${id}/register`, { method: "POST" }),
    settle: (id: string, rankedPlayerIds: string[]) =>
      request<{ ok: true }>(`/tournaments/${id}/settle`, { method: "POST", body: JSON.stringify({ rankedPlayerIds }) }),
  },
};

export interface FactionSummary {
  id: string;
  name: string;
  tag: string;
  rep: number;
  memberCount: number;
}

export interface FactionDetail extends FactionSummary {
  members: Array<{
    playerId: string;
    rank: string;
    joinedAt: string;
    player: { handle: string; level: number; rep: number; repTier: string };
  }>;
}

export interface DistrictSummary {
  id: string;
  key: string;
  name: string;
  controller: { id: string; name: string; tag: string } | null;
  epochEndsAt: string | null;
  topInfluence: Array<[string, number]>;
  totalInfluence: number;
}

export interface DistrictDetail extends DistrictSummary {
  influence: Record<string, number>;
}

export interface MarketListingRow {
  id: string;
  assetType: string;
  assetRef: string;
  price: string;
  status: string;
  createdAt: string;
  seller: { handle: string; repTier: string };
  carModel?: { name: string; carClass: string; accentColor: string } | null;
}

export interface WalletInfo {
  custodialAddress: string;
  usdcBalance: string;
  xlmBalance: string;
  linkedWallets: Array<{ id: string; publicKey: string; verifiedAt: string }>;
}

export interface TournamentRow {
  id: string;
  name: string;
  mode: string;
  currency: string;
  entryFee: string;
  bracketSize: number;
  status: string;
  startsAt: string;
  createdAt: string;
}

export interface BetPoolRow {
  id: string;
  raceId: string;
  kind: string; // WIN | PODIUM
  rakeBps: number;
  closesAt: string;
  trackId: string;
  mode: string;
  totalStaked: string;
  entrants: Array<{ playerId: string; handle: string; repTier: string; staked: string }>;
}

export interface MyBetRow {
  id: string;
  poolId: string;
  raceId: string;
  kind: string;
  poolStatus: string;
  selectionId: string;
  stake: string;
  payout: string | null;
  createdAt: string;
}

export interface LeaderboardRow {
  rank: number;
  id: string;
  handle: string;
  level: number;
  rep: number;
  tier: string;
  wins: number;
}

export interface CarUpgrade {
  id: string;
  slot: string;
  tier: number;
}

export interface CarWithUpgrades {
  id: string;
  modelKey: string;
  carClass: string;
  nickname: string | null;
  livery: Record<string, unknown>;
  upgrades: CarUpgrade[];
}
