"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";
import { useSessionStore } from "@/stores/sessionStore";

/**
 * Mounts at the root layout. On first load: if we have a stored token,
 * refresh the profile. If no token, create a guest session automatically —
 * the player is racing before they ever think about accounts.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, setSession, setProfile, clear } = useSessionStore();

  useEffect(() => {
    async function init() {
      if (accessToken) {
        try {
          const profile = await api.players.me();
          setProfile(profile);
        } catch {
          // Token expired or server down — create a new guest session.
          clear();
          await createGuest();
        }
      } else {
        await createGuest();
      }
    }

    async function createGuest() {
      try {
        const { accessToken: token } = await api.auth.guest();
        // Store token first so subsequent api calls are authenticated.
        useSessionStore.setState({ accessToken: token });
        const profile = await api.players.me();
        setSession(token, profile);
      } catch {
        // API down (offline mode) — session stays null; game works fine offline.
      }
    }

    void init();
  }, []); // run once on mount

  return <>{children}</>;
}
