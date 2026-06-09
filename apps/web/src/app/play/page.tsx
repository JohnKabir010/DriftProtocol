"use client";

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
  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <RaceScene />
      <RaceHud />
    </main>
  );
}
