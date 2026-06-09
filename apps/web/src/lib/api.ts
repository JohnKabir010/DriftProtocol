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
  },
  garage: {
    cars: () => request<CarWithUpgrades[]>("/garage/cars"),
    upgrade: (carId: string, slot: string) =>
      request<{ ok: true }>(`/garage/cars/${carId}/upgrade`, {
        method: "POST",
        body: JSON.stringify({ slot }),
      }),
    livery: (carId: string, livery: Record<string, unknown>) =>
      request<{ ok: true }>(`/garage/cars/${carId}/livery`, {
        method: "POST",
        body: JSON.stringify(livery),
      }),
  },
  matchmaking: {
    queue: (mode: string, carClass: string) =>
      request<{ queued: true }>("/matchmaking/queue", { method: "POST", body: JSON.stringify({ mode, carClass }) }),
    poll: () => request<MatchTicket | { waiting: true }>("/matchmaking/ticket"),
    quick: (mode: string, carClass: string) =>
      request<MatchTicket>("/matchmaking/quick", { method: "POST", body: JSON.stringify({ mode, carClass }) }),
  },
};

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
