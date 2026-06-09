"use client";

import { useEffect, useState } from "react";
import { useRaceStore } from "@/stores/raceStore";
import { NITRO } from "@drift/shared";

function formatTime(ms: number): string {
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function Countdown() {
  const endsAt = useRaceStore((s) => s.countdownEndsAt);
  const [remaining, setRemaining] = useState(3);
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))), 100);
    return () => clearInterval(id);
  }, [endsAt]);
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div
        key={remaining}
        className="font-display text-9xl text-neon-volt drop-shadow-[0_0_40px_rgba(204,255,0,0.7)] animate-ping"
      >
        {remaining > 0 ? remaining : "GO"}
      </div>
    </div>
  );
}

function Results() {
  const results = useRaceStore((s) => s.results);
  if (!results) return null;
  return (
    <div className="absolute inset-0 grid place-items-center bg-void/70 backdrop-blur-sm pointer-events-auto">
      <div className="holo-card px-12 py-8 min-w-[420px]">
        <h2 className="font-display text-3xl text-neon-cyan mb-6 tracking-widest">RACE COMPLETE</h2>
        {results.map((r) => (
          <div
            key={r.position}
            className={`flex justify-between gap-8 py-2 border-b border-white/10 ${r.isLocal ? "text-neon-volt" : "text-white/80"}`}
          >
            <span className="font-display">#{r.position}</span>
            <span className="flex-1">{r.handle}</span>
            <span className="tabular-nums">{r.finishTimeMs ? formatTime(r.finishTimeMs) : "DNF"}</span>
            <span className="text-neon-magenta tabular-nums">{r.driftScore.toLocaleString()} drift</span>
          </div>
        ))}
        <button
          onClick={() => window.location.reload()}
          className="mt-8 w-full holo-card py-3 font-display text-neon-volt hover:shadow-neon-cyan transition-shadow"
        >
          RACE AGAIN
        </button>
      </div>
    </div>
  );
}

/** DOM HUD — crisp, cheap, transform-only animations over the canvas. */
export function RaceHud() {
  const phase = useRaceStore((s) => s.phase);
  const speedKmh = useRaceStore((s) => s.speedKmh);
  const boosting = useRaceStore((s) => s.boosting);
  const bottles = useRaceStore((s) => s.nitroBottles);
  const charge = useRaceStore((s) => s.nitroCharge);
  const driftChain = useRaceStore((s) => s.driftChain);
  const driftScore = useRaceStore((s) => s.driftScore);
  const lap = useRaceStore((s) => s.lap);
  const totalLaps = useRaceStore((s) => s.totalLaps);
  const raceTimeMs = useRaceStore((s) => s.raceTimeMs);

  return (
    <div className="pointer-events-none absolute inset-0 p-6 flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <div className="holo-card px-4 py-2 font-display text-sm text-neon-cyan">
          NEON ROW CIRCUIT · LAP {lap}/{totalLaps}
        </div>
        <div className="holo-card px-4 py-2 font-display text-lg text-white tabular-nums">
          {formatTime(raceTimeMs)}
        </div>
        <div className="holo-card px-4 py-2 font-display text-sm text-white/60">
          W drive · A/D steer · SPACE drift · SHIFT nitro
        </div>
      </div>

      {/* Drift chain popup — center-right, only while a chain is live */}
      {driftChain > 0 && (
        <div className="absolute right-12 top-1/3 text-right">
          <div className="font-display text-4xl text-neon-magenta drop-shadow-[0_0_18px_rgba(255,46,151,0.8)] tabular-nums">
            +{driftChain.toLocaleString()}
          </div>
          <div className="font-display text-xs text-white/60 tracking-[0.3em]">DRIFT CHAIN</div>
        </div>
      )}

      <div className="flex justify-between items-end">
        <div className="holo-card px-6 py-4">
          <div className="flex items-center gap-2">
            {Array.from({ length: NITRO.bottles }, (_, i) => (
              <div
                key={i}
                className={`w-3 h-8 skew-x-[-12deg] transition-colors ${
                  i < bottles ? "bg-neon-volt shadow-neon-cyan" : "bg-white/10"
                }`}
              />
            ))}
            <span className="ml-2 font-display text-xs text-white/50">NITRO</span>
          </div>
          {/* Charge toward the next bottle */}
          <div className="mt-2 h-1 w-full bg-white/10">
            <div
              className="h-full bg-neon-cyan transition-[width]"
              style={{ width: `${Math.min((charge / NITRO.chargePerBottle) * 100, 100)}%` }}
            />
          </div>
          <div className="mt-2 font-display text-xs text-neon-magenta tabular-nums">
            DRIFT {driftScore.toLocaleString()}
          </div>
        </div>

        <div className={`holo-card px-8 py-4 text-right ${boosting ? "shadow-neon-cyan" : ""}`}>
          <div
            className={`font-display text-5xl tabular-nums leading-none ${boosting ? "text-neon-volt" : "text-neon-cyan"}`}
          >
            {Math.round(speedKmh)}
          </div>
          <div className="font-display text-xs text-white/50 tracking-widest mt-1">KM/H</div>
        </div>
      </div>

      {phase === "COUNTDOWN" && <Countdown />}
      {phase === "FINISHED" && <Results />}
    </div>
  );
}
