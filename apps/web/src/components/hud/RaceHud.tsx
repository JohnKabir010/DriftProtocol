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

// SVG arc helper — returns an SVG path "d" attribute for an arc
function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const sweep = endDeg - startDeg;
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

function SpeedGauge({ speedKmh, boosting }: { speedKmh: number; boosting: boolean }) {
  const cx = 100;
  const cy = 100;
  const r = 80;
  const startDeg = 225;
  const totalSweep = 270;
  const maxSpeed = 250;

  const fraction = Math.min(speedKmh / maxSpeed, 1);
  const endDeg = startDeg + fraction * totalSweep;

  const bgArcPath = describeArc(cx, cy, r, startDeg, startDeg + totalSweep);
  const speedArcPath = fraction > 0 ? describeArc(cx, cy, r, startDeg, endDeg) : null;

  const arcColor = boosting ? "#CCFF00" : "#00F0FF";
  const arcGlow = boosting
    ? "drop-shadow(0 0 8px rgba(204,255,0,0.9))"
    : "drop-shadow(0 0 8px rgba(0,240,255,0.9))";

  // Tick marks every 30° around the gauge
  const ticks = Array.from({ length: 10 }, (_, i) => {
    const deg = startDeg + i * 30;
    const rad = (deg * Math.PI) / 180;
    const inner = 68;
    const outer = 74;
    return {
      x1: cx + inner * Math.cos(rad),
      y1: cy + inner * Math.sin(rad),
      x2: cx + outer * Math.cos(rad),
      y2: cy + outer * Math.sin(rad),
    };
  });

  return (
    <div className={`holo-card p-3 ${boosting ? "shadow-neon-cyan" : ""} transition-shadow duration-300`}>
      <svg viewBox="0 0 200 200" className="w-44 h-44" aria-label={`Speed: ${Math.round(speedKmh)} km/h`}>
        {/* Tick marks */}
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        ))}

        {/* Background arc */}
        <path
          d={bgArcPath}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Speed arc */}
        {speedArcPath && (
          <path
            d={speedArcPath}
            fill="none"
            stroke={arcColor}
            strokeWidth="8"
            strokeLinecap="round"
            style={{ filter: arcGlow, transition: "d 0.05s linear" }}
          />
        )}

        {/* Speed number */}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="36"
          fontFamily="var(--font-display, monospace)"
          fontWeight="700"
          fill={boosting ? "#CCFF00" : "#ffffff"}
          style={{ transition: "fill 0.15s" }}
        >
          {Math.round(speedKmh)}
        </text>

        {/* KM/H label */}
        <text
          x={cx}
          y={cy + 22}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="9"
          fontFamily="var(--font-display, monospace)"
          letterSpacing="4"
          fill="rgba(255,255,255,0.4)"
        >
          KM/H
        </text>
      </svg>
    </div>
  );
}

function NitroPanel({ bottles, charge, driftScore }: { bottles: number; charge: number; driftScore: number }) {
  const chargePct = Math.min((charge / NITRO.chargePerBottle) * 100, 100);

  return (
    <div className="holo-card px-5 py-4 flex flex-col gap-2 min-w-[140px]">
      <span className="font-display text-[10px] text-white/40 tracking-[0.3em]">NITRO</span>

      {/* Bottle bars */}
      <div className="flex gap-[2px] items-end">
        {Array.from({ length: NITRO.bottles }, (_, i) => (
          <div
            key={i}
            className={`w-4 h-10 skew-x-[-12deg] transition-colors duration-200 ${
              i < bottles
                ? "bg-neon-volt shadow-[0_0_8px_rgba(0,240,255,0.6)]"
                : "bg-white/[0.08]"
            }`}
          />
        ))}
      </div>

      {/* Charge bar */}
      <div className="h-[3px] w-full bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-neon-cyan rounded-full transition-[width] duration-75"
          style={{ width: `${chargePct}%` }}
        />
      </div>

      {/* Drift score */}
      <div className="flex flex-col gap-0.5 mt-1">
        <span className="font-display text-[10px] text-white/30 tracking-[0.2em]">DRIFT SCORE</span>
        <span className="font-display text-xl text-neon-magenta tabular-nums leading-none">
          {driftScore.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function DriftChainPopup({ driftChain }: { driftChain: number }) {
  const multiplier = driftChain > 5000 ? "×4" : driftChain > 2000 ? "×3" : driftChain > 500 ? "×2" : "×1";
  const chainIntensity = Math.min((driftChain / 10000) * 100, 100);

  return (
    <div
      className={`transition-opacity duration-200 ${driftChain > 0 ? "opacity-100" : "opacity-0"}`}
    >
      <div className="holo-card px-6 py-4 relative min-w-[180px]">
        {/* Multiplier badge */}
        <span className="absolute top-2 right-3 font-display text-[10px] text-neon-magenta/60 tracking-widest">
          {multiplier}
        </span>

        {/* Chain value */}
        <div
          key={driftChain}
          className="font-display text-5xl text-neon-magenta tabular-nums leading-none"
          style={{ textShadow: "0 0 24px rgba(255,46,151,0.8), 0 0 48px rgba(255,46,151,0.4)" }}
        >
          +{driftChain.toLocaleString()}
        </div>

        {/* Label */}
        <div className="font-display text-xs text-white/40 tracking-[0.4em] mt-1">
          DRIFT CHAIN
        </div>

        {/* Chain intensity bar */}
        <div className="mt-3 h-[2px] w-full bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-150"
            style={{
              width: `${chainIntensity}%`,
              background: "linear-gradient(90deg, #FF2E97 0%, #FF2E97cc 100%)",
              boxShadow: "0 0 6px rgba(255,46,151,0.7)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Countdown() {
  const endsAt = useRaceStore((s) => s.countdownEndsAt);
  const [remaining, setRemaining] = useState(3);

  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(
      () => setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))),
      100
    );
    return () => clearInterval(id);
  }, [endsAt]);

  const colorClass =
    remaining === 3
      ? "text-red-500"
      : remaining === 2
      ? "text-[#FF9500]"
      : remaining === 1
      ? "text-neon-volt"
      : "text-neon-cyan";

  const glowStyle =
    remaining === 0
      ? { textShadow: "0 0 40px rgba(0,240,255,0.9), 0 0 80px rgba(0,240,255,0.5)" }
      : remaining === 1
      ? { textShadow: "0 0 40px rgba(204,255,0,0.9), 0 0 80px rgba(204,255,0,0.5)" }
      : remaining === 2
      ? { textShadow: "0 0 40px rgba(255,149,0,0.9)" }
      : { textShadow: "0 0 40px rgba(255,60,60,0.9)" };

  return (
    <div className="absolute inset-0 grid place-items-center bg-void/40 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <div
          key={remaining}
          className={`font-display text-[160px] leading-none anim-slam ${colorClass}`}
          style={glowStyle}
        >
          {remaining > 0 ? remaining : "GO"}
        </div>

        {/* Neon divider line */}
        <div
          className="h-[2px] w-[200px] rounded-full"
          style={{
            background:
              remaining === 0
                ? "linear-gradient(90deg, transparent, #00F0FF, transparent)"
                : remaining === 1
                ? "linear-gradient(90deg, transparent, #CCFF00, transparent)"
                : remaining === 2
                ? "linear-gradient(90deg, transparent, #FF9500, transparent)"
                : "linear-gradient(90deg, transparent, #FF3C3C, transparent)",
            boxShadow:
              remaining === 0
                ? "0 0 12px rgba(0,240,255,0.8)"
                : remaining === 1
                ? "0 0 12px rgba(204,255,0,0.8)"
                : "0 0 12px rgba(255,100,0,0.8)",
          }}
        />
      </div>
    </div>
  );
}

function Results() {
  const results = useRaceStore((s) => s.results);
  if (!results) return null;

  const positionColor = (pos: number) => {
    if (pos === 1) return "text-[#FFD700]";
    if (pos === 2) return "text-[#C0C0C0]";
    if (pos === 3) return "text-[#CD7F32]";
    return "text-white/20";
  };

  const localResult = results.find((r) => r.isLocal);
  const hasRewards = localResult && (localResult.creditsEarned || localResult.repEarned);

  return (
    <div className="absolute inset-0 bg-void/85 backdrop-blur-md flex items-center justify-center pointer-events-auto">
      <div className="holo-card px-14 py-10 min-w-[500px]">
        {/* Header */}
        <h2
          className="font-display text-4xl text-neon-cyan tracking-widest"
          style={{ textShadow: "0 0 20px rgba(0,240,255,0.7), 0 0 40px rgba(0,240,255,0.3)" }}
        >
          RACE COMPLETE
        </h2>

        {/* Neon divider */}
        <div
          className="mt-3 mb-5 h-[1px] w-full"
          style={{
            background: "linear-gradient(90deg, #00F0FF40, #00F0FF, #00F0FF40)",
            boxShadow: "0 0 8px rgba(0,240,255,0.5)",
          }}
        />

        {/* Results rows */}
        <div className="flex flex-col gap-1">
          {results.map((r) => (
            <div
              key={r.position}
              className={`flex items-center gap-5 px-3 py-2.5 rounded border-l-2 transition-colors ${
                r.isLocal
                  ? "bg-neon-volt/5 border-neon-volt/60"
                  : "bg-transparent border-transparent hover:bg-white/[0.03]"
              }`}
            >
              <span className={`font-display text-3xl w-10 shrink-0 ${positionColor(r.position)}`}>
                {r.position}
              </span>
              <span
                className={`font-display text-base flex-1 ${r.isLocal ? "text-neon-volt" : "text-white/80"}`}
              >
                {r.handle}
              </span>
              <span className="tabular-nums text-white/70 text-sm font-mono">
                {r.finishTimeMs ? formatTime(r.finishTimeMs) : "DNF"}
              </span>
              <span className="text-neon-magenta tabular-nums text-sm font-display w-28 text-right">
                {r.driftScore.toLocaleString()} drift
              </span>
            </div>
          ))}
        </div>

        {/* Rewards */}
        {hasRewards && (
          <>
            <div
              className="mt-5 mb-4 h-[1px] w-full"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
              }}
            />
            <div className="flex gap-3 justify-center flex-wrap">
              {localResult.creditsEarned && (
                <span className="font-display text-sm px-4 py-1.5 rounded-sm bg-neon-volt/10 border border-neon-volt/30 text-neon-volt tracking-wider">
                  +₵{localResult.creditsEarned.toLocaleString()} CREDITS
                </span>
              )}
              {localResult.repEarned && (
                <span className="font-display text-sm px-4 py-1.5 rounded-sm bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan tracking-wider">
                  +{localResult.repEarned} REP
                </span>
              )}
              {localResult.levelUp && (
                <span className="font-display text-sm px-4 py-1.5 text-neon-magenta tracking-wider animate-pulse">
                  LEVEL UP ▲
                </span>
              )}
            </div>
          </>
        )}

        {/* Race Again */}
        <button
          onClick={() => window.location.reload()}
          className="mt-6 w-full holo-card py-3 font-display text-neon-volt hover:shadow-neon-cyan transition-shadow tracking-widest text-sm"
        >
          RACE AGAIN
        </button>
      </div>
    </div>
  );
}

export function RaceHud() {
  const phase = useRaceStore((s) => s.phase);
  const trackName = useRaceStore((s) => s.trackName);
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
    <div className="pointer-events-none absolute inset-0 p-6">
      {/* ── Top-Left: Lap & Track Info ── */}
      <div className="absolute top-6 left-6">
        <div className="holo-card px-4 py-2 flex flex-col gap-0.5 min-w-[160px]">
          <span className="font-display text-[10px] text-white/40 tracking-[0.3em]">
            {trackName || "CIRCUIT"}
          </span>
          <div className="h-[1px] w-full bg-white/10 my-0.5" />
          <span className="font-display text-lg text-neon-cyan leading-tight">
            LAP {lap}/{totalLaps}
          </span>
        </div>
      </div>

      {/* ── Top-Center: Race Timer ── */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2">
        <div className="holo-card px-5 py-2">
          <span className="font-display text-2xl text-white tabular-nums">
            {formatTime(raceTimeMs)}
          </span>
        </div>
      </div>

      {/* ── Top-Right: Controls Hint ── */}
      <div className="absolute top-6 right-6">
        <div className="holo-card px-3 py-1.5">
          <span className="font-display text-[10px] text-white/30 tracking-wider">
            W/↑ DRIVE &nbsp; A/D STEER &nbsp; SPACE DRIFT &nbsp; SHIFT NITRO
          </span>
        </div>
      </div>

      {/* ── Center-Right: Drift Chain Popup ── */}
      <div className="absolute inset-0 flex items-start justify-end pr-16 top-[35%] pointer-events-none">
        <div
          className={`transition-opacity duration-200 ${driftChain > 0 ? "opacity-100" : "opacity-0"}`}
        >
          <DriftChainPopup driftChain={driftChain} />
        </div>
      </div>

      {/* ── Bottom-Left: Nitro + Drift Score ── */}
      <div className="absolute bottom-6 left-6">
        <NitroPanel bottles={bottles} charge={charge} driftScore={driftScore} />
      </div>

      {/* ── Bottom-Right: Circular Speedometer ── */}
      <div className="absolute bottom-6 right-6">
        <SpeedGauge speedKmh={speedKmh} boosting={boosting} />
      </div>

      {/* ── Overlays ── */}
      {phase === "COUNTDOWN" && <Countdown />}
      {phase === "FINISHED" && <Results />}
    </div>
  );
}
