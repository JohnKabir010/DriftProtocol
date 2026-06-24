"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PlayerProfile {
  id: string;
  handle: string;
  level: number;
  xp: number;
  rep: number;
  repTier: "STREET" | "UNDERGROUND" | "SYNDICATE" | "LEGEND";
  credits: string; // bigint serialised as string
  avatarUrl: string | null;
  /** "guest" until the player links Google/Discord. */
  authProvider?: string;
}

interface SessionStore {
  accessToken: string | null;
  profile: PlayerProfile | null;
  loading: boolean;
  setSession: (token: string, profile: PlayerProfile) => void;
  setProfile: (profile: PlayerProfile) => void;
  patch: (partial: Partial<Pick<SessionStore, "profile">>) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      accessToken: null,
      profile: null,
      loading: false,
      setSession: (accessToken, profile) => set({ accessToken, profile }),
      setProfile: (profile) => set({ profile }),
      patch: (partial) => set(partial),
      clear: () => set({ accessToken: null, profile: null }),
    }),
    { name: "drift-session", partialize: (s) => ({ accessToken: s.accessToken, profile: s.profile }) },
  ),
);
