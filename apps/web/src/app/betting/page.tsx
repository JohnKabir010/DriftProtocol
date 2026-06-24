"use client";

import { useCallback, useEffect, useState } from "react";
import { TRACKS } from "@drift/shared";
import { api, type BetPoolRow, type MyBetRow } from "@/lib/api";
import { useSessionStore } from "@/stores/sessionStore";
import { HoloCard } from "@/components/ui/HoloCard";
import { NeonButton } from "@/components/ui/NeonButton";

/** Pari-mutuel: implied payout per credit = distributable pool / selection stake. */
function impliedMultiplier(pool: BetPoolRow, staked: string): string {
  const total = Number(pool.totalStaked);
  const onSelection = Number(staked);
  if (total === 0 || onSelection === 0) return "—";
  const distributable = total * (1 - pool.rakeBps / 10_000);
  return `${(distributable / onSelection).toFixed(2)}×`;
}

function countdown(closesAt: string, now: number): string {
  const ms = new Date(closesAt).getTime() - now;
  if (ms <= 0) return "LOCKED";
  return `${Math.ceil(ms / 1000)}s`;
}

function PoolCard({ pool, now, onBet }: { pool: BetPoolRow; now: number; onBet: () => void }) {
  const [selection, setSelection] = useState("");
  const [stake, setStake] = useState("100");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const trackName = TRACKS[pool.trackId]?.name ?? pool.trackId;

  async function place() {
    if (!selection) return;
    setError("");
    setBusy(true);
    try {
      await api.betting.place(pool.id, selection, parseInt(stake));
      onBet();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bet failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <HoloCard className="p-4 space-y-3" glow={pool.kind === "WIN" ? "cyan" : "magenta"}>
      <div className="flex items-center justify-between">
        <span
          className={`font-display text-[10px] px-1.5 py-0.5 border ${
            pool.kind === "WIN"
              ? "text-neon-cyan border-neon-cyan/40"
              : "text-neon-magenta border-neon-magenta/40"
          }`}
        >
          {pool.kind === "WIN" ? "WINNER" : "PODIUM (TOP 3)"}
        </span>
        <span className="font-display text-xs text-neon-volt">{countdown(pool.closesAt, now)}</span>
      </div>

      <div>
        <div className="font-display text-base text-white">{trackName}</div>
        <div className="text-white/40 text-xs">
          {pool.mode} · pool ₵{Number(pool.totalStaked).toLocaleString()} ·{" "}
          {(pool.rakeBps / 100).toFixed(1)}% rake
        </div>
      </div>

      <div className="space-y-1">
        {pool.entrants.map((e) => (
          <button
            key={e.playerId}
            onClick={() => setSelection(e.playerId)}
            className={`w-full flex items-center justify-between px-3 py-1.5 border text-left transition-colors ${
              selection === e.playerId
                ? "border-neon-volt/60 bg-neon-volt/10"
                : "border-white/10 hover:border-white/30"
            }`}
          >
            <span className="font-display text-xs text-white">{e.handle}</span>
            <span className="font-display text-[10px] text-white/50">
              ₵{Number(e.staked).toLocaleString()} · {impliedMultiplier(pool, e.staked)}
            </span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <input
          type="number"
          value={stake}
          onChange={(e) => setStake(e.target.value)}
          min={50}
          max={50_000}
          className="w-28 bg-white/5 border border-neon-cyan/20 text-neon-volt font-display text-sm px-3 py-1.5 focus:outline-none"
        />
        <NeonButton size="sm" variant="volt" onClick={place} disabled={busy || !selection}>
          {busy ? "…" : "PLACE BET"}
        </NeonButton>
      </div>
      {error && <p className="font-display text-xs text-neon-danger">{error}</p>}
    </HoloCard>
  );
}

const BET_STATUS: Record<string, string> = {
  OPEN: "text-neon-cyan",
  LOCKED: "text-neon-volt",
  SETTLED: "text-white/60",
  VOIDED: "text-white/30",
};

export default function BettingPage() {
  const profile = useSessionStore((s) => s.profile);
  const [pools, setPools] = useState<BetPoolRow[]>([]);
  const [mine, setMine] = useState<MyBetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const credits = Number(profile?.credits ?? 0);

  const load = useCallback(async () => {
    try {
      const [open, my] = await Promise.all([
        api.betting.open(),
        api.betting.mine().catch(() => []),
      ]);
      setPools(open);
      setMine(my);
    } catch {}
    finally { setLoading(false); }
  }, []);

  // Pools open and lock on a seconds timescale — poll while the page is up.
  useEffect(() => {
    void load();
    const poll = setInterval(() => void load(), 5000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [load]);

  return (
    <main className="min-h-screen pt-20 px-6 pb-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-3xl text-neon-cyan">RACE BETTING</h1>
          <p className="text-white/40 text-sm mt-1">
            Pari-mutuel pools · Credits only · racers can&apos;t bet on their own race · Your balance:{" "}
            <span className="text-neon-volt font-display">₵{credits.toLocaleString()}</span>
          </p>
        </div>

        {loading ? (
          <div className="font-display text-neon-cyan/40 animate-pulse pt-20 text-center">SCANNING GRID…</div>
        ) : pools.length === 0 ? (
          <HoloCard className="p-10 text-center">
            <p className="font-display text-white/20">
              No races forming right now — pools open the moment matchmaking fills a grid.
            </p>
          </HoloCard>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {pools.map((p) => (
              <PoolCard key={p.id} pool={p} now={now} onBet={load} />
            ))}
          </div>
        )}

        {mine.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-display text-lg text-white/70">MY BETS</h2>
            <HoloCard className="divide-y divide-white/5">
              {mine.map((b) => (
                <div key={b.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="text-xs">
                    <span className="font-display text-white">{b.kind}</span>{" "}
                    <span className="text-white/40">· staked ₵{Number(b.stake).toLocaleString()}</span>
                  </div>
                  <div className="font-display text-xs">
                    <span className={BET_STATUS[b.poolStatus] ?? "text-white/40"}>{b.poolStatus}</span>
                    {b.payout !== null && (
                      <span className={`ml-3 ${Number(b.payout) > 0 ? "text-neon-volt" : "text-white/30"}`}>
                        {Number(b.payout) > 0 ? `+₵${Number(b.payout).toLocaleString()}` : "LOST"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </HoloCard>
          </div>
        )}
      </div>
    </main>
  );
}
