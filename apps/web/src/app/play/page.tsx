"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { RaceHud } from "@/components/hud/RaceHud";

// The 3D scene is a client-only island; never SSR'd, keeps marketing routes light.
const RaceScene = dynamic(() => import("@/components/game/RaceScene"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen grid place-items-center font-display text-neon-cyan animate-pulse">
      ENTERING NEO-MERIDIAN…
    </div>
  ),
});

export default function PlayPage() {
  // ?online enables the experimental multiplayer path (needs api+realtime up).
  // Resolved after mount to avoid an SSR/hydration mismatch on search params.
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    setOnline(new URLSearchParams(window.location.search).has("online"));
  }, []);

  if (online === null) return null;
  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <RaceScene online={online} />
      <RaceHud />
    </main>
  );
}
