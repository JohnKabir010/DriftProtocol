"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { buildTrack, TRACKS, type TrackDef, type TrackTheme } from "@drift/shared";
import { HoloCard } from "@/components/ui/HoloCard";
import { NeonButton } from "@/components/ui/NeonButton";

/** Per-theme card styling: accent color + label. Mirrors the 3D environments. */
const THEME_META: Record<TrackTheme, { label: string; accent: string; sky: string }> = {
  "neon-city": { label: "NEON CITY", accent: "#00f0ff", sky: "#0a1322" },
  "rain-city": { label: "RAIN · NIGHT", accent: "#3aa7ff", sky: "#070d16" },
  mountain: { label: "MOUNTAIN PASS", accent: "#dce8f5", sky: "#26303f" },
  forest: { label: "FOREST RALLY", accent: "#7fae8c", sky: "#13211a" },
  hills: { label: "DUSK HILLS", accent: "#ff7e5f", sky: "#2a1c33" },
  canyon: { label: "OPEN CANYON", accent: "#ffa040", sky: "#3d2113" },
};

/** The track's real racing line, rendered as an SVG path from sim samples. */
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
    <svg viewBox="0 0 100 100" className="w-full h-36">
      <path d={path} fill="none" stroke={accent} strokeWidth="3" strokeLinejoin="round" opacity="0.25" />
      <path d={path} fill="none" stroke={accent} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

const DIFFICULTY_META = {
  easy:   { label: "EASY",   color: "#7fae8c", reward: "₵20%"  },
  medium: { label: "MEDIUM", color: "#ffa040", reward: "₵35%"  },
  hard:   { label: "HARD",   color: "#ff2e97", reward: "₵50%"  },
} as const;

function BotButtons({ trackId }: { trackId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative mt-auto pt-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left font-display text-xs tracking-widest py-2 px-3 border border-neon-cyan/30 hover:border-neon-cyan/60 text-neon-cyan/80 hover:text-neon-cyan transition-colors"
      >
        VS BOTS {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="absolute z-10 left-0 right-0 border border-neon-cyan/30 bg-void/95 backdrop-blur-sm">
          {(Object.entries(DIFFICULTY_META) as [keyof typeof DIFFICULTY_META, typeof DIFFICULTY_META[keyof typeof DIFFICULTY_META]][]).map(([key, d]) => (
            <Link
              key={key}
              href={`/play?track=${trackId}&bots=${key}`}
              className="flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
            >
              <span className="font-display text-xs tracking-widest" style={{ color: d.color }}>
                {d.label}
              </span>
              <span className="font-display text-[10px] text-white/40">{d.reward} credits</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function TrackCard({ def }: { def: TrackDef }) {
  const meta = THEME_META[def.theme ?? "neon-city"];
  const length = useMemo(() => Math.round(buildTrack(def).totalLength), [def]);

  return (
    <HoloCard className="p-5 space-y-3 flex flex-col">
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

      <div className="font-display text-lg text-white">{def.name}</div>

      <BotButtons trackId={def.id} />
      <Link href={`/play?track=${def.id}&online`} className="block mt-1">
        <NeonButton size="sm" variant="volt" className="w-full">
          RACE ONLINE
        </NeonButton>
      </Link>
    </HoloCard>
  );
}

export default function TracksPage() {
  const tracks = Object.values(TRACKS);
  return (
    <main className="min-h-screen pt-20 px-6 pb-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-3xl text-neon-cyan">SELECT TRACK</h1>
          <p className="text-white/40 text-sm mt-1">
            {tracks.length} circuits across Neo-Meridian and beyond · VS BOTS pays 20–50% credits by difficulty · online races pay full credits + rep
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tracks.map((def) => (
            <TrackCard key={def.id} def={def} />
          ))}
        </div>
      </div>
    </main>
  );
}
