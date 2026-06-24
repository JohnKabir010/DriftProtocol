"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { RaceHud } from "@/components/hud/RaceHud";
import { SpeedOverlay } from "@/components/game/vfx/SpeedOverlay";
import { TouchControls } from "@/components/game/TouchControls";
import { sharedInput } from "@/game/useInput";
import { useRef } from "react";

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
  const [params, setParams] = useState<{
    online: boolean;
    trackId?: string;
    botDifficulty?: "easy" | "medium" | "hard";
  } | null>(null);
  const inputRef = useRef(sharedInput);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const bots = search.get("bots");
    setParams({
      online: search.has("online"),
      trackId: search.get("track") ?? undefined,
      botDifficulty: (bots === "easy" || bots === "medium" || bots === "hard") ? bots : undefined,
    });
  }, []);

  if (params === null) return null;
  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <RaceScene online={params.online} trackId={params.trackId} botDifficulty={params.botDifficulty} />
      <SpeedOverlay />
      <TouchControls inputRef={inputRef} />
      <RaceHud />
    </main>
  );
}
