"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useSessionStore } from "@/stores/sessionStore";

/**
 * OAuth landing page. The API redirects here with the session in the URL
 * fragment (never sent to servers). We store it, hydrate the profile, scrub
 * the fragment from history, and bounce home.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    async function finish() {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const token = params.get("token");
      if (!token) {
        setError("Sign-in failed — no session returned.");
        return;
      }
      window.history.replaceState(null, "", window.location.pathname);

      useSessionStore.setState({ accessToken: token });
      try {
        const profile = await api.players.me();
        useSessionStore.getState().setSession(token, profile);
        router.replace("/");
      } catch {
        setError("Signed in, but the profile could not be loaded. Try refreshing.");
      }
    }
    void finish();
  }, [router]);

  return (
    <main className="min-h-screen grid place-items-center">
      <p className={`font-display ${error ? "text-neon-danger" : "text-neon-cyan animate-pulse"}`}>
        {error || "LINKING IDENTITY…"}
      </p>
    </main>
  );
}
