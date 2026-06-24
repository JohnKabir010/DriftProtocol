"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { buildTrack, TRACKS, type TrackDef, type TrackTheme } from "@drift/shared";
import { HoloCard } from "@/components/ui/HoloCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { motion } from "framer-motion";

type Difficulty = "easy" | "medium" | "hard";

const THEME_META: Record<TrackTheme, { label: string; accent: string; sky: string }> = {
  "neon-city": { label: "NEON CITY",    accent: "#00f0ff", sky: "#0a1322" },
  "rain-city": { label: "RAIN · NIGHT", accent: "#3aa7ff", sky: "#070d16" },
  mountain:    { label: "MOUNTAIN PASS",accent: "#dce8f5", sky: "#26303f" },
  forest:      { label: "FOREST RALLY", accent: "#7fae8c", sky: "#13211a" },
  hills:       { label: "DUSK HILLS",   accent: "#ff7e5f", sky: "#2a1c33" },
  canyon:      { label: "OPEN CANYON",  accent: "#ffa040", sky: "#3d2113" },
};

const DIFFICULTY_CONFIG: Record<Difficulty, {
  label: string; color: string; border: string; reward: string;
  bots: string; desc: string;
}> = {
  easy: {
    label: "EASY", color: "#7fae8c", border: "border-[#7fae8c]/40 hover:border-[#7fae8c]/80",
    reward: "20% credits",
    bots: "GHOSTLINE · KIRIN · NULLDRIVE",
    desc: "Slowest AI drivers. Ideal for learning a new track.",
  },
  medium: {
    label: "MEDIUM", color: "#ffa040", border: "border-[#ffa040]/40 hover:border-[#ffa040]/80",
    reward: "35% credits",
    bots: "KIRIN · NULLDRIVE · VEC-7",
    desc: "Mixed field. A genuine challenge at speed.",
  },
  hard: {
    label: "HARD", color: "#ff2e97", border: "border-[#ff2e97]/40 hover:border-[#ff2e97]/80",
    reward: "50% credits",
    bots: "VEC-7 · NULLDRIVE · KIRIN",
    desc: "Fastest AI opponents. Beat them to earn real credits.",
  },
};

function TrackShape({ def, accent }: { def: TrackDef; accent: string }) {
  const path = useMemo(() => {
    const track = buildTrack(def);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const s of track.samples) {
      minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x);
      minZ = Math.min(minZ, s.z); maxZ = Math.max(maxZ, s.z);
    }
    const span = Math.max(maxX - minX, maxZ - minZ);
    const pad = span * 0.1;
    const scale = 100 / (span + pad * 2);
    const ox = (minX + maxX) / 2;
    const oz = (minZ + maxZ) / 2;
    const pts = track.samples.map(
      (s) => `${((s.x - ox) * scale + 50).toFixed(1)},${((s.z - oz) * scale + 50).toFixed(1)}`,
    );
    return `M${pts.join("L")}Z`;
  }, [def]);

  return (
    <svg viewBox="0 0 100 100" className="w-full h-28">
      <path d={path} fill="none" stroke={accent} strokeWidth="3" strokeLinejoin="round" opacity="0.2" />
      <path d={path} fill="none" stroke={accent} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function TrackBotCard({ def, difficulty }: { def: TrackDef; difficulty: Difficulty }) {
  const meta = THEME_META[def.theme ?? "neon-city"];
  const diff = DIFFICULTY_CONFIG[difficulty];
  const length = useMemo(() => Math.round(buildTrack(def).totalLength), [def]);

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
      <HoloCard className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span
            className="font-display text-[10px] px-1.5 py-0.5 border tracking-widest"
            style={{ color: meta.accent, borderColor: `${meta.accent}50` }}
          >
            {meta.label}
          </span>
          <span className="font-display text-[10px] text-white/40 tracking-widest">
            {def.laps} LAP{def.laps > 1 ? "S" : ""} · {(length / 1000).toFixed(1)} KM
          </span>
        </div>

        <div className="rounded-sm" style={{ background: meta.sky }}>
          <TrackShape def={def} accent={meta.accent} />
        </div>

        <div className="font-display text-base text-white">{def.name}</div>

        <Link href={`/play?track=${def.id}&bots=${difficulty}`} className="block">
          <NeonButton
            size="sm"
            className="w-full"
            style={{ borderColor: diff.color + "80", color: diff.color } as React.CSSProperties}
          >
            RACE — {diff.reward}
          </NeonButton>
        </Link>
      </HoloCard>
    </motion.div>
  );
}

export default function BotRacePage() {
  const [difficulty, setDifficulty] = useState<Difficulty>("hard");
  const tracks = Object.values(TRACKS);
  const diff = DIFFICULTY_CONFIG[difficulty];

  return (
    <main className="min-h-screen pt-20 px-6 pb-12">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="font-display text-3xl text-neon-cyan">VS BOTS</h1>
          <p className="text-white/40 text-sm mt-1">
            Race 3 AI opponents instantly — no queue, no waiting. Earn credits based on difficulty.
          </p>
        </div>

        {/* Difficulty selector */}
        <div className="grid grid-cols-3 gap-3">
          {(Object.entries(DIFFICULTY_CONFIG) as [Difficulty, typeof diff][]).map(([key, d]) => (
            <button
              key={key}
              onClick={() => setDifficulty(key)}
              className={`holo-card px-4 py-4 text-left border transition-all duration-200 ${d.border} ${difficulty === key ? "bg-white/5" : ""}`}
            >
              <div className="font-display text-lg tracking-widest" style={{ color: d.color }}>
                {d.label}
              </div>
              <div className="font-display text-[10px] text-white/50 mt-0.5 tracking-widest">
                {d.reward}
              </div>
              <div className="text-white/35 text-xs mt-2 leading-relaxed">{d.desc}</div>
              <div className="font-display text-[9px] text-white/25 tracking-widest mt-2">
                BOTS: {d.bots}
              </div>
            </button>
          ))}
        </div>

        {/* Active difficulty banner */}
        <div
          className="holo-card px-4 py-3 flex items-center gap-3 border"
          style={{ borderColor: diff.color + "50" }}
        >
          <span className="font-display text-xs tracking-widest" style={{ color: diff.color }}>
            {diff.label} MODE
          </span>
          <span className="text-white/30 text-xs">·</span>
          <span className="text-white/50 text-xs">{diff.bots}</span>
          <span className="text-white/30 text-xs">·</span>
          <span className="text-white/50 text-xs">{diff.reward} on finish</span>
          <span className="text-white/30 text-xs">·</span>
          <span className="text-white/40 text-xs">no rep awarded</span>
        </div>

        {/* Track grid */}
        <div>
          <p className="font-display text-xs tracking-widest text-white/30 mb-4">
            SELECT TRACK — {tracks.length} CIRCUITS
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tracks.map((def, i) => (
              <motion.div
                key={def.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.04, ease: [0.23, 1, 0.32, 1] }}
              >
                <TrackBotCard def={def} difficulty={difficulty} />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
