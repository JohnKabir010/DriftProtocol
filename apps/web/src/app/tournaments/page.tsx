"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type TournamentRow } from "@/lib/api";
import { useSessionStore } from "@/stores/sessionStore";
import { HoloCard } from "@/components/ui/HoloCard";
import { NeonButton } from "@/components/ui/NeonButton";

const STATUS_COLORS: Record<string, string> = {
  REGISTRATION: "text-neon-cyan",
  LOCKED: "text-white/40",
  RUNNING: "text-neon-volt",
  SETTLED: "text-neon-magenta",
};

function timeLabel(dateStr: string) {
  const d = new Date(dateStr);
  const ms = d.getTime() - Date.now();
  if (ms < 0) return "started";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `in ${h}h ${m}m` : `in ${m}m`;
}

function TournamentCard({ t, credits, onRegister }: { t: TournamentRow; credits: number; onRegister: () => void }) {
  const [busy, setBusy] = useState(false);
  const fee = parseInt(t.entryFee);
  const canAfford = credits >= fee;

  async function register() {
    setBusy(true);
    try { await api.tournaments.register(t.id); onRegister(); }
    catch {}
    finally { setBusy(false); }
  }

  return (
    <HoloCard className="p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-display text-base text-white">{t.name}</div>
          <div className="flex items-center gap-3 mt-1">
            <span className="font-display text-[10px] px-1.5 py-0.5 border border-white/10 text-white/40">
              {t.mode}
            </span>
            <span className={`font-display text-[10px] ${STATUS_COLORS[t.status] ?? "text-white/30"}`}>
              {t.status}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-lg text-neon-volt">₵{fee.toLocaleString()}</div>
          <div className="text-white/30 text-xs">entry fee</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="font-display text-sm text-neon-cyan">{t.bracketSize}</div>
          <div className="text-white/30 text-[10px]">MAX PLAYERS</div>
        </div>
        <div>
          <div className="font-display text-sm text-white/60">{timeLabel(t.startsAt)}</div>
          <div className="text-white/30 text-[10px]">STARTS</div>
        </div>
        <div>
          <div className="font-display text-sm text-neon-cyan">
            ${(fee * t.bracketSize * 0.001).toFixed(0)}
          </div>
          <div className="text-white/30 text-[10px]">USDC POOL</div>
        </div>
      </div>

      {t.status === "REGISTRATION" && (
        <NeonButton
          variant="volt"
          onClick={register}
          disabled={busy || !canAfford}
          className="w-full"
        >
          {busy ? "…" : !canAfford ? `NEED ₵${fee.toLocaleString()}` : `REGISTER ₵${fee.toLocaleString()}`}
        </NeonButton>
      )}
    </HoloCard>
  );
}

function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: () => void }) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState("CIRCUIT");
  const [entryFee, setEntryFee] = useState("200");
  const [bracketSize, setBracketSize] = useState("8");
  const [startsAt, setStartsAt] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(""); setBusy(true);
    try {
      await api.tournaments.create({
        name, mode,
        entryFee: parseInt(entryFee),
        bracketSize: parseInt(bracketSize),
        startsAt: new Date(startsAt).toISOString(),
      });
      onCreate(); onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-void/80 backdrop-blur-sm z-50 grid place-items-center">
      <HoloCard className="p-8 w-96 space-y-5" glow="volt">
        <h2 className="font-display text-xl text-neon-volt">CREATE TOURNAMENT</h2>
        <div className="space-y-3">
          {[
            { label: "NAME", value: name, set: setName, type: "text", placeholder: "Neon Row Grand Prix" },
            { label: "ENTRY FEE (₵)", value: entryFee, set: setEntryFee, type: "number", placeholder: "200" },
            { label: "BRACKET SIZE", value: bracketSize, set: setBracketSize, type: "number", placeholder: "8" },
            { label: "STARTS AT", value: startsAt, set: setStartsAt, type: "datetime-local", placeholder: "" },
          ].map(({ label, value, set, type, placeholder }) => (
            <div key={label}>
              <label className="font-display text-[10px] text-white/40 tracking-widest">{label}</label>
              <input
                type={type}
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={placeholder}
                className="mt-1 w-full bg-white/5 border border-white/10 text-white font-display text-sm px-3 py-2 focus:outline-none focus:border-neon-volt/40"
              />
            </div>
          ))}
          <div>
            <label className="font-display text-[10px] text-white/40 tracking-widest">MODE</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}
              className="mt-1 w-full bg-white/5 border border-white/10 text-white font-display text-sm px-3 py-2 focus:outline-none">
              {["SPRINT", "CIRCUIT", "ELIMINATION", "TOURNAMENT"].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="font-display text-xs text-neon-danger">{error}</p>}
        <div className="flex gap-3">
          <NeonButton variant="volt" onClick={submit} disabled={busy || !name || !startsAt}>
            {busy ? "CREATING…" : "CREATE"}
          </NeonButton>
          <NeonButton variant="magenta" onClick={onClose}>CANCEL</NeonButton>
        </div>
      </HoloCard>
    </div>
  );
}

export default function TournamentsPage() {
  const profile = useSessionStore((s) => s.profile);
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const credits = Number(profile?.credits ?? 0);

  const load = useCallback(() => {
    api.tournaments.list()
      .then((list) => setTournaments(list.map((t) => ({ ...t, entryFee: String(t.entryFee) }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const open = tournaments.filter((t) => t.status === "REGISTRATION");
  const past = tournaments.filter((t) => t.status !== "REGISTRATION");

  return (
    <main className="min-h-screen pt-20 px-6 pb-10">
      {creating && <CreateModal onClose={() => setCreating(false)} onCreate={load} />}
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl text-neon-volt">TOURNAMENTS</h1>
            <p className="text-white/40 text-sm mt-1">
              Credits entry · USDC prize pool · Stellar settlement
            </p>
          </div>
          <NeonButton variant="volt" onClick={() => setCreating(true)}>+ CREATE</NeonButton>
        </div>

        {loading ? (
          <div className="font-display text-neon-volt/40 animate-pulse pt-20 text-center">LOADING…</div>
        ) : (
          <>
            <section className="space-y-4">
              <h2 className="font-display text-xs tracking-widest text-white/30">OPEN REGISTRATION</h2>
              {open.length === 0 ? (
                <HoloCard className="p-8 text-center">
                  <p className="font-display text-white/20">No open tournaments. Create one.</p>
                </HoloCard>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {open.map((t) => <TournamentCard key={t.id} t={t} credits={credits} onRegister={load} />)}
                </div>
              )}
            </section>

            {past.length > 0 && (
              <section className="space-y-4">
                <h2 className="font-display text-xs tracking-widest text-white/30">RECENT</h2>
                <div className="grid grid-cols-2 gap-4">
                  {past.map((t) => <TournamentCard key={t.id} t={t} credits={credits} onRegister={load} />)}
                </div>
              </section>
            )}
          </>
        )}

        <HoloCard className="p-5 space-y-2">
          <div className="font-display text-xs text-neon-cyan">HOW PRIZES WORK</div>
          <div className="grid grid-cols-3 gap-4 pt-2">
            {[
              { pos: "1ST", credits: "50%", usdc: "$10 USDC" },
              { pos: "2ND", credits: "30%", usdc: "$5 USDC" },
              { pos: "3RD", credits: "15%", usdc: "$2 USDC" },
            ].map(({ pos, credits: c, usdc }) => (
              <div key={pos} className="text-center space-y-1 border border-white/5 p-3">
                <div className="font-display text-sm text-neon-volt">{pos}</div>
                <div className="font-display text-xs text-white/60">{c} of Credits pool</div>
                <div className="font-display text-xs text-neon-cyan">+ {usdc}</div>
              </div>
            ))}
          </div>
          <p className="text-white/20 text-[10px] pt-2">
            Credits prizes come from the entry fee pool. USDC prizes are funded by the house treasury
            and sent on-chain via Stellar. 4th place gets 5% of Credits pool, no USDC.
          </p>
        </HoloCard>
      </div>
    </main>
  );
}
