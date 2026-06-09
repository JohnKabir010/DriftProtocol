"use client";

import { HoloCard } from "@/components/ui/HoloCard";

const TIER_COLORS: Record<string, string> = {
  LEGEND: "text-neon-volt",
  SYNDICATE: "text-neon-magenta",
  UNDERGROUND: "text-neon-cyan",
  STREET: "text-white/60",
};

// Static placeholder — wired to the real API leaderboard query in Phase 4.
const PLACEHOLDER = Array.from({ length: 10 }, (_, i) => ({
  rank: i + 1,
  handle: [`NightRacer`, `GhostDrift`, `NeonWraith`, `AxleBreaker`, `ChromeSerpent`, `VoidRunner`, `Parallex`, `Syndra_X`, `HoloQueen`, `DistrictZero`][i]!,
  rep: [14200, 11800, 9600, 8100, 6550, 5300, 4200, 3100, 2400, 1800][i]!,
  tier: ["LEGEND", "LEGEND", "SYNDICATE", "SYNDICATE", "UNDERGROUND", "UNDERGROUND", "UNDERGROUND", "STREET", "STREET", "STREET"][i]!,
  wins: [88, 74, 61, 53, 41, 35, 29, 22, 17, 12][i]!,
}));

export default function LeaderboardPage() {
  return (
    <main className="min-h-screen pt-20 px-6 pb-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-3xl text-neon-cyan">STANDINGS</h1>
          <p className="text-white/40 text-sm mt-1">Neo-Meridian underground rep rankings</p>
        </div>

        <HoloCard className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neon-cyan/10">
                {["#", "DRIVER", "REP", "WINS", "TIER"].map((h) => (
                  <th key={h} className="font-display text-[10px] text-white/30 tracking-widest py-3 px-4 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLACEHOLDER.map((row) => (
                <tr key={row.rank} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3 font-display text-white/40 tabular-nums">{row.rank}</td>
                  <td className="px-4 py-3 font-display text-white">{row.handle}</td>
                  <td className="px-4 py-3 font-display text-neon-cyan tabular-nums">
                    {row.rep.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-display text-white/60 tabular-nums">{row.wins}</td>
                  <td className={`px-4 py-3 font-display text-xs ${TIER_COLORS[row.tier] ?? ""}`}>
                    {row.tier}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </HoloCard>

        <div className="font-display text-[10px] text-white/20 text-center tracking-widest">
          LIVE DATA IN PHASE 4 — FACTIONS UPDATE
        </div>
      </div>
    </main>
  );
}
