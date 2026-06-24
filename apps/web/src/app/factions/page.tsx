"use client";

import { useEffect, useState } from "react";
import { api, type FactionDetail, type FactionSummary } from "@/lib/api";
import { useSessionStore } from "@/stores/sessionStore";
import { HoloCard } from "@/components/ui/HoloCard";
import { NeonButton } from "@/components/ui/NeonButton";

const TIER_COLORS: Record<string, string> = {
  LEGEND: "text-neon-volt",
  SYNDICATE: "text-neon-magenta",
  UNDERGROUND: "text-neon-cyan",
  STREET: "text-white/50",
};

const RANK_ORDER = ["BOSS", "OFFICER", "RACER", "PROSPECT"];

function CreateModal({ onClose, onCreate }: { onClose: () => void; onCreate: () => void }) {
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError("");
    setBusy(true);
    try {
      await api.factions.create(name, tag);
      onCreate();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-void/80 backdrop-blur-sm z-50 grid place-items-center pointer-events-auto">
      <HoloCard className="p-8 w-96 space-y-5" glow="cyan">
        <h2 className="font-display text-xl text-neon-cyan">FOUND FACTION</h2>
        <p className="text-white/40 text-xs">Costs ₵500 · Requires UNDERGROUND rep (800+)</p>
        <div className="space-y-3">
          <div>
            <label className="font-display text-[10px] text-white/40 tracking-widest">FACTION NAME</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
              className="mt-1 w-full bg-white/5 border border-neon-cyan/20 text-white font-display text-sm px-3 py-2 focus:outline-none focus:border-neon-cyan/60"
              placeholder="Night Syndicate"
            />
          </div>
          <div>
            <label className="font-display text-[10px] text-white/40 tracking-widest">TAG (2-5 chars)</label>
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value.toUpperCase())}
              maxLength={5}
              className="mt-1 w-full bg-white/5 border border-neon-cyan/20 text-neon-volt font-display text-sm px-3 py-2 focus:outline-none focus:border-neon-cyan/60"
              placeholder="NTSYN"
            />
          </div>
        </div>
        {error && <p className="font-display text-xs text-neon-danger">{error}</p>}
        <div className="flex gap-3 pt-2">
          <NeonButton variant="cyan" onClick={submit} disabled={busy || !name || !tag}>
            {busy ? "FOUNDING…" : "FOUND ₵500"}
          </NeonButton>
          <NeonButton variant="magenta" onClick={onClose}>CANCEL</NeonButton>
        </div>
      </HoloCard>
    </div>
  );
}

function FactionCard({
  faction,
  myFactionId,
  onAction,
}: {
  faction: FactionSummary;
  myFactionId?: string;
  onAction: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const isMine = faction.id === myFactionId;

  async function join() {
    setBusy(true);
    try { await api.factions.join(faction.id); onAction(); }
    catch { /* show toast in Phase 5 */ }
    finally { setBusy(false); }
  }

  return (
    <HoloCard className={`p-5 ${isMine ? "border-neon-volt/50" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display text-sm text-neon-cyan bg-neon-cyan/10 px-2 py-0.5">
              [{faction.tag}]
            </span>
            {isMine && <span className="font-display text-[10px] text-neon-volt">YOUR FACTION</span>}
          </div>
          <div className="font-display text-base text-white">{faction.name}</div>
          <div className="text-white/40 text-xs mt-1">
            {faction.memberCount} members · <span className="text-neon-cyan">{faction.rep.toLocaleString()} rep</span>
          </div>
        </div>
        {!isMine && !myFactionId && (
          <NeonButton size="sm" onClick={join} disabled={busy}>
            {busy ? "…" : "JOIN"}
          </NeonButton>
        )}
      </div>
    </HoloCard>
  );
}

function FactionDetailPanel({ id }: { id: string }) {
  const [detail, setDetail] = useState<FactionDetail | null>(null);
  useEffect(() => { api.factions.get(id).then(setDetail).catch(() => {}); }, [id]);

  if (!detail) return <div className="font-display text-white/20 animate-pulse pt-8 text-center">LOADING…</div>;

  const sorted = [...detail.members].sort(
    (a, b) => RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank),
  );

  return (
    <div className="space-y-4">
      <div className="font-display text-xl text-neon-cyan">[{detail.tag}] {detail.name}</div>
      <div className="text-white/40 text-sm">{detail.memberCount} members · {detail.rep.toLocaleString()} faction rep</div>
      <div className="space-y-1 pt-2">
        <div className="font-display text-[10px] text-white/30 tracking-widest mb-2">ROSTER</div>
        {sorted.map((m) => (
          <div key={m.playerId} className="flex items-center justify-between py-1.5 border-b border-white/5">
            <div>
              <span className="font-display text-sm text-white">{m.player.handle}</span>
              <span className="ml-2 font-display text-[10px] text-white/30">Lv.{m.player.level}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`font-display text-xs ${TIER_COLORS[m.player.repTier] ?? ""}`}>
                {m.player.repTier}
              </span>
              <span className="font-display text-[10px] text-white/40 border border-white/10 px-1.5 py-0.5">
                {m.rank}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FactionsPage() {
  const profile = useSessionStore((s) => s.profile);
  const [factions, setFactions] = useState<FactionSummary[]>([]);
  const [myFactionId, setMyFactionId] = useState<string | undefined>();
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [list, me] = await Promise.all([api.factions.list(), api.factions.me().catch(() => null)]);
      setFactions(list);
      const member = me as any;
      setMyFactionId(member?.faction?.id ?? member?.factionId ?? undefined);
      if (!selected && list.length > 0) setSelected(list[0]!.id);
    } catch {}
  }

  useEffect(() => { void load(); }, []);

  async function leave() {
    setBusy(true);
    try { await api.factions.leave(); await load(); }
    catch {}
    finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen pt-20 px-6 pb-10">
      {creating && <CreateModal onClose={() => setCreating(false)} onCreate={load} />}
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl text-neon-cyan">FACTIONS</h1>
            <p className="text-white/40 text-sm mt-1">Join a crew. Contest districts. Rule the night.</p>
          </div>
          <div className="flex gap-3">
            {myFactionId ? (
              <NeonButton variant="magenta" size="sm" onClick={leave} disabled={busy}>
                LEAVE FACTION
              </NeonButton>
            ) : (
              profile && (
                <NeonButton variant="volt" onClick={() => setCreating(true)}>
                  FOUND FACTION
                </NeonButton>
              )
            )}
          </div>
        </div>

        {factions.length === 0 ? (
          <HoloCard className="p-10 text-center">
            <p className="font-display text-white/20">No factions yet. Be the first to found one.</p>
          </HoloCard>
        ) : (
          <div className="grid grid-cols-[300px_1fr] gap-6">
            <div className="space-y-3">
              {factions.map((f) => (
                <button key={f.id} onClick={() => setSelected(f.id)} className="w-full text-left">
                  <FactionCard faction={f} myFactionId={myFactionId} onAction={load} />
                </button>
              ))}
            </div>
            <HoloCard className="p-6">
              {selected ? (
                <FactionDetailPanel id={selected} />
              ) : (
                <div className="font-display text-white/20 pt-8 text-center">SELECT A FACTION</div>
              )}
            </HoloCard>
          </div>
        )}
      </div>
    </main>
  );
}
