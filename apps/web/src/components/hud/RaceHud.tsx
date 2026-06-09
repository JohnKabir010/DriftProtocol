"use client";

import { useRaceStore } from "@/stores/raceStore";

/**
 * DOM-rendered HUD (not canvas) so it stays crisp and cheap — transform-only
 * animations, no layout thrash at 60fps.
 */
export function RaceHud() {
  const speedKmh = useRaceStore((s) => s.telemetry.speedKmh);
  const nitro = useRaceStore((s) => s.nitroBottles);

  return (
    <div className="pointer-events-none absolute inset-0 p-6 flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <div className="holo-card px-4 py-2 font-display text-sm text-neon-cyan">NEON ROW — SPRINT</div>
        <div className="holo-card px-4 py-2 font-display text-sm text-white/70">
          WASD drive · SPACE handbrake · SHIFT nitro
        </div>
      </div>

      <div className="flex justify-between items-end">
        <div className="holo-card px-6 py-4 flex items-center gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className={`w-3 h-8 skew-x-[-12deg] ${i < nitro ? "bg-neon-volt shadow-neon-cyan" : "bg-white/10"}`}
            />
          ))}
          <span className="ml-2 font-display text-xs text-white/50">NITRO</span>
        </div>

        <div className="holo-card px-8 py-4 text-right">
          <div className="font-display text-5xl text-neon-cyan tabular-nums leading-none">
            {Math.round(speedKmh)}
          </div>
          <div className="font-display text-xs text-white/50 tracking-widest mt-1">KM/H</div>
        </div>
      </div>
    </div>
  );
}
