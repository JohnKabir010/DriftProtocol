"use client";

import { useEffect, useState } from "react";
import { api, type LeaderboardRow } from "@/lib/api";
import { HoloCard } from "@/components/ui/HoloCard";

const TIER_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  LEGEND:     { color: "text-neon-volt",    bg: "bg-neon-volt/10",    border: "border-neon-volt/30" },
  SYNDICATE:  { color: "text-neon-magenta", bg: "bg-neon-magenta/10", border: "border-neon-magenta/30" },
  UNDERGROUND:{ color: "text-neon-cyan",    bg: "bg-neon-cyan/10",    border: "border-neon-cyan/30" },
  STREET:     { color: "text-white/50",     bg: "bg-white/5",         border: "border-white/10" },
};

const PODIUM_COLORS = ["#C0C0C0", "#FFD700", "#CD7F32"] as const;

function TierBadge({ tier }: { tier: string }) {
  const cfg = TIER_CONFIG[tier] ?? TIER_CONFIG["STREET"]!;
  return (
    <span
      className={`font-display text-[10px] px-2 py-0.5 tracking-widest border corner-cut-sm ${cfg.color} ${cfg.bg} ${cfg.border}`}
    >
      {tier}
    </span>
  );
}

function PodiumCard({ entry, podiumRank }: { entry: LeaderboardRow; podiumRank: 1 | 2 | 3 }) {
  const accentColor = PODIUM_COLORS[podiumRank - 1];
  const topPad  = podiumRank === 1 ? "pt-4"  : podiumRank === 2 ? "pt-8" : "pt-10";
  const numSize = podiumRank === 1 ? "text-5xl" : podiumRank === 2 ? "text-3xl" : "text-2xl";

  return (
    <div
      className={`holo-card p-5 flex flex-col items-center gap-2 ${topPad}`}
      style={{
        borderColor: `${accentColor}40`,
        boxShadow: podiumRank === 1 ? `0 0 30px ${accentColor}22, 0 0 70px ${accentColor}08` : undefined,
      }}
    >
      {podiumRank === 1 && (
        <span className="font-display text-[10px] tracking-[0.4em] mb-1" style={{ color: "#FFD700" }}>
          CHAMPION
        </span>
      )}
      <span
        className={`font-display ${numSize} tabular-nums leading-none`}
        style={{ color: accentColor, textShadow: `0 0 22px ${accentColor}70` }}
      >
        #{entry.rank}
      </span>
      <div className="font-display text-base text-white text-center mt-1">{entry.handle}</div>
      <div
        className="font-display text-2xl tabular-nums"
        style={{ color: "#00F0FF", textShadow: "0 0 14px rgba(0,240,255,0.5)" }}
      >
        {entry.rep.toLocaleString()}
      </div>
      <div className="font-display text-[10px] text-white/30">REP</div>
      <TierBadge tier={entry.tier} />
      <div className="font-display text-[10px] text-white/40 mt-1">{entry.wins} WINS</div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.players.leaderboard()
      .then(setRows)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load standings"))
      .finally(() => setLoading(false));
  }, []);

  const top3 = rows.slice(0, 3);
  const rest  = rows.slice(3);

  return (
    <main className="relative min-h-screen pt-20 px-6 pb-10 overflow-hidden">
      {/* Atmosphere */}
      <div className="absolute inset-0 grid-bg-sm opacity-30 pointer-events-none" />
      <div className="absolute -top-32 right-1/4 w-80 h-80 rounded-full bg-neon-cyan/[0.04] blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-64 h-64 rounded-full bg-neon-magenta/[0.04] blur-[100px] pointer-events-none" />

      <div className="relative max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="font-display text-[10px] tracking-[0.5em] text-neon-magenta/60 mb-2">NEO-MERIDIAN</div>
            <h1 className="font-display text-4xl text-neon-cyan text-glow-cyan tracking-widest">STANDINGS</h1>
            <p className="font-display text-[10px] tracking-widest text-white/30 mt-1">
              UNDERGROUND REP RANKINGS · SEASON 1
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { dot: "dot-cyan",    label: `${rows.length} RACERS` },
              { dot: "dot-volt",    label: "LIVE DATA" },
              { dot: "dot-magenta", label: "SEASON 1" },
            ].map(({ dot, label }) => (
              <div key={label} className="holo-card-sm px-3 py-1.5 flex items-center gap-2">
                <span className={dot} />
                <span className="font-display text-[10px] text-white/50 tracking-widest">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="neon-divider" />

        {error ? (
          <HoloCard className="p-10 text-center">
            <p className="font-display text-neon-magenta text-sm tracking-widest">SIGNAL LOST</p>
            <p className="font-display text-white/30 text-xs mt-2">{error}</p>
          </HoloCard>
        ) : loading ? (
          <div className="space-y-3">
            {/* Podium skeleton */}
            <div className="grid grid-cols-3 gap-4 items-end">
              {[2, 1, 3].map((n) => (
                <div
                  key={n}
                  className={`holo-card p-5 flex flex-col items-center gap-3 animate-pulse ${n === 1 ? "" : n === 2 ? "mt-8" : "mt-10"}`}
                >
                  <div className="w-12 h-12 bg-white/5 rounded" />
                  <div className="w-24 h-3 bg-white/5 rounded" />
                  <div className="w-16 h-5 bg-white/5 rounded" />
                </div>
              ))}
            </div>
            {/* Row skeletons */}
            <div className="holo-card overflow-hidden">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-white/[0.04] animate-pulse">
                  <div className="w-8 h-3 bg-white/5 rounded" />
                  <div className="w-32 h-3 bg-white/5 rounded" />
                  <div className="flex-1 h-3 bg-white/5 rounded" />
                  <div className="w-12 h-3 bg-white/5 rounded" />
                  <div className="w-20 h-5 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          </div>
        ) : rows.length === 0 ? (
          <HoloCard className="p-10 text-center">
            <p className="font-display text-white/20">No races recorded yet — be the first on the board.</p>
          </HoloCard>
        ) : (
          <>
            {/* Podium — order: 2nd · 1st · 3rd */}
            {top3.length >= 3 && (
              <div className="grid grid-cols-3 gap-4 items-end">
                <PodiumCard entry={top3[1]!} podiumRank={2} />
                <PodiumCard entry={top3[0]!} podiumRank={1} />
                <PodiumCard entry={top3[2]!} podiumRank={3} />
              </div>
            )}

            {/* Rank 4+ */}
            {rest.length > 0 && (
              <HoloCard className="overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-neon-cyan/10">
                      {["RANK", "DRIVER", "REP", "WINS", "TIER"].map((h) => (
                        <th
                          key={h}
                          className="font-display text-[10px] text-white/30 tracking-[0.35em] py-3 px-4 text-left"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((row, idx) => (
                      <tr
                        key={row.id}
                        className="border-b border-white/[0.04] hover:bg-neon-cyan/[0.04] transition-colors"
                      >
                        <td
                          className="px-4 py-3 font-display tabular-nums text-sm"
                          style={{ color: idx < 2 ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.28)" }}
                        >
                          {row.rank}
                        </td>
                        <td className="px-4 py-3 font-display text-sm text-white">{row.handle}</td>
                        <td className="px-4 py-3 font-display text-neon-cyan tabular-nums text-sm">
                          {row.rep.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-display text-white/50 tabular-nums text-sm">{row.wins}</td>
                        <td className="px-4 py-3">
                          <TierBadge tier={row.tier} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </HoloCard>
            )}
          </>
        )}

        {/* Footer */}
        <div className="flex items-center justify-center gap-3">
          <span className="dot-cyan animate-pulse" />
          <span className="font-display text-[10px] tracking-[0.4em] text-white/20">
            LIVE DATA · SORTED BY REP
          </span>
        </div>
      </div>
    </main>
  );
}
