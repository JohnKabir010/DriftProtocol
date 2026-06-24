"use client";

import { useEffect, useState } from "react";
import { api, type DistrictSummary } from "@/lib/api";
import { HoloCard } from "@/components/ui/HoloCard";

const DISTRICT_THEMES: Record<string, { accent: string; description: string; icon: string }> = {
  "neon-row":     { accent: "#00f0ff", description: "The strip. Every surface covered in ads.", icon: "◈" },
  docklands:      { accent: "#ff2e97", description: "Rain-slicked waterfront. Long straights, hard chicanes.", icon: "⬡" },
  "the-stacks":   { accent: "#ccff00", description: "Vertical city. Rooftop-to-rooftop hairpins.", icon: "▲" },
  "skyline-loop": { accent: "#ffffff", description: "Elevated expressway ring. Legends only.", icon: "◎" },
};

function msUntil(dateStr: string | null): string {
  if (!dateStr) return "—";
  const ms = new Date(dateStr).getTime() - Date.now();
  if (ms <= 0) return "ended";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function InfluenceBar({ name, score, total, color }: { name: string; score: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between font-display text-[10px]">
        <span className="text-white/60">{name}</span>
        <span style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1 bg-white/10">
        <div className="h-full transition-[width] duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function DistrictCard({ d }: { d: DistrictSummary }) {
  const theme = DISTRICT_THEMES[d.key] ?? { accent: "#00f0ff", description: "", icon: "●" };

  return (
    <HoloCard className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-display text-2xl" style={{ color: theme.accent }}>
            {theme.icon} {d.name}
          </div>
          <p className="text-white/40 text-xs mt-1">{theme.description}</p>
        </div>
        <div className="text-right">
          <div className="font-display text-[10px] text-white/30 tracking-widest">EPOCH ENDS</div>
          <div className="font-display text-sm text-white/60 mt-0.5">{msUntil(d.epochEndsAt)}</div>
        </div>
      </div>

      <div className="flex items-center gap-3 py-3 border-y border-white/5">
        {d.controller ? (
          <>
            <span className="font-display text-xs text-white/40">CONTROLLED BY</span>
            <span
              className="font-display text-sm px-2 py-0.5"
              style={{ color: theme.accent, background: `${theme.accent}18`, border: `1px solid ${theme.accent}40` }}
            >
              [{d.controller.tag}] {d.controller.name}
            </span>
          </>
        ) : (
          <span className="font-display text-xs text-white/30">UNCLAIMED — first faction to race here controls it</span>
        )}
      </div>

      {d.topInfluence.length > 0 ? (
        <div className="space-y-2">
          <div className="font-display text-[10px] text-white/30 tracking-widest">INFLUENCE</div>
          {d.topInfluence.map(([factionId, score]) => (
            <InfluenceBar
              key={factionId}
              name={factionId.slice(0, 8)}
              score={score}
              total={d.totalInfluence}
              color={theme.accent}
            />
          ))}
        </div>
      ) : (
        <div className="font-display text-[10px] text-white/20">No races yet this epoch</div>
      )}
    </HoloCard>
  );
}

export default function DistrictsPage() {
  const [districts, setDistricts] = useState<DistrictSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.districts.list()
      .then(setDistricts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Client-side epoch countdown ticks.
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="min-h-screen pt-20 px-6 pb-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-3xl text-neon-cyan">DISTRICTS</h1>
          <p className="text-white/40 text-sm mt-1">
            Race in a district with your faction to earn influence. Top faction at epoch close takes control.
          </p>
        </div>

        {loading ? (
          <div className="font-display text-neon-cyan/40 animate-pulse pt-20 text-center">
            MAPPING NEO-MERIDIAN…
          </div>
        ) : districts.length === 0 ? (
          <HoloCard className="p-10 text-center space-y-2">
            <p className="font-display text-white/30">Districts not seeded yet.</p>
            <p className="text-white/20 text-sm">Run <code className="text-neon-cyan">pnpm db:seed</code> with the API running.</p>
          </HoloCard>
        ) : (
          <div className="grid grid-cols-2 gap-5">
            {districts.map((d) => <DistrictCard key={d.id} d={d} />)}
          </div>
        )}
      </div>
    </main>
  );
}
