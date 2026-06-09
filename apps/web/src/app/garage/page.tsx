"use client";

import { useEffect, useState, useCallback } from "react";
import { CAR_CATALOG, UpgradeSlot, upgradeCost, resolveHandling } from "@drift/shared";
import { api, type CarWithUpgrades } from "@/lib/api";
import { useSessionStore } from "@/stores/sessionStore";
import { HoloCard } from "@/components/ui/HoloCard";
import { NeonButton } from "@/components/ui/NeonButton";

const SLOTS: UpgradeSlot[] = ["ENGINE", "TRANSMISSION", "TIRES", "NITRO", "ECU", "WEIGHT"];
const SLOT_ICONS: Record<UpgradeSlot, string> = {
  ENGINE: "⚡", TRANSMISSION: "⚙", TIRES: "◎", NITRO: "🔥", ECU: "◈", WEIGHT: "▼",
};

function StatBar({ label, value, max = 1.5 }: { label: string; value: number; max?: number }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between font-display text-[10px] text-white/50">
        <span>{label}</span>
        <span className="text-neon-cyan">{value.toFixed(2)}</span>
      </div>
      <div className="h-1 bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-neon-cyan to-neon-volt transition-[width] duration-500"
          style={{ width: `${Math.min((value / max) * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

function CarCard({
  car,
  selected,
  onSelect,
}: {
  car: CarWithUpgrades;
  selected: boolean;
  onSelect: () => void;
}) {
  const model = CAR_CATALOG[car.modelKey];
  if (!model) return null;
  return (
    <button
      onClick={onSelect}
      className={`holo-card p-4 text-left w-full transition-all ${
        selected ? "border-neon-cyan/60 shadow-neon-cyan" : "border-neon-cyan/15 hover:border-neon-cyan/35"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-display text-xs" style={{ color: model.accentColor }}>
          CLASS {car.carClass}
        </span>
        <span className="font-display text-[10px] text-white/40">
          {car.upgrades.length}/6 SLOTS
        </span>
      </div>
      <div className="font-display text-base text-white mb-0.5">{model.name}</div>
      {car.nickname && <div className="text-xs text-white/40 italic">"{car.nickname}"</div>}
      <div className="mt-3 flex gap-1">
        {SLOTS.map((slot) => {
          const tier = car.upgrades.find((u) => u.slot === slot)?.tier ?? 0;
          return (
            <div key={slot} className="flex flex-col gap-0.5">
              {Array.from({ length: 5 }, (_, i) => (
                <div
                  key={i}
                  className={`w-2 h-1 ${i < tier ? "bg-neon-volt" : "bg-white/10"}`}
                />
              ))}
            </div>
          );
        })}
      </div>
    </button>
  );
}

function UpgradePanel({ car, credits, onPurchased }: { car: CarWithUpgrades; credits: number; onPurchased: () => void }) {
  const [busy, setBusy] = useState<UpgradeSlot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const model = CAR_CATALOG[car.modelKey];
  if (!model) return null;

  const upgradeMap = Object.fromEntries(car.upgrades.map((u) => [u.slot, u.tier])) as Partial<Record<UpgradeSlot, number>>;
  const handling = resolveHandling(car.modelKey, upgradeMap);

  async function purchase(slot: UpgradeSlot) {
    setError(null);
    setBusy(slot);
    try {
      await api.garage.upgrade(car.id, slot);
      onPurchased();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="font-display text-lg text-neon-cyan">{model.name}</div>
      <div className="font-display text-xs text-white/40 tracking-widest">{model.description}</div>

      <div className="space-y-2 pt-2">
        <div className="font-display text-[10px] text-white/30 tracking-widest">PERFORMANCE</div>
        <StatBar label="ENGINE" value={handling.engineMult} />
        <StatBar label="GRIP" value={handling.gripMult} />
        <StatBar label="TOP SPEED" value={2 - handling.dragMult} />
        <StatBar label="DRIFT ENTRY" value={handling.driftEntryMult} />
        <StatBar label="NITRO" value={handling.nitroMult} />
      </div>

      <div className="space-y-2 pt-2">
        <div className="font-display text-[10px] text-white/30 tracking-widest">UPGRADE SLOTS</div>
        {SLOTS.map((slot) => {
          const tier = upgradeMap[slot] ?? 0;
          const maxed = tier >= 5;
          const cost = maxed ? null : upgradeCost(slot, tier + 1);
          const canAfford = cost === null || credits >= Number(cost);
          return (
            <div key={slot} className="holo-card px-3 py-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base">{SLOT_ICONS[slot]}</span>
                <span className="font-display text-xs text-white/70">{slot}</span>
              </div>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className={`w-3 h-1.5 ${i < tier ? "bg-neon-volt" : "bg-white/10"}`} />
                ))}
              </div>
              {maxed ? (
                <span className="font-display text-[10px] text-neon-cyan/60">MAX</span>
              ) : (
                <NeonButton
                  size="sm"
                  variant="volt"
                  disabled={!canAfford || busy === slot}
                  onClick={() => purchase(slot)}
                >
                  {busy === slot ? "…" : `₵${cost?.toLocaleString()}`}
                </NeonButton>
              )}
            </div>
          );
        })}
      </div>

      {error && <div className="font-display text-xs text-neon-danger">{error}</div>}
    </div>
  );
}

export default function GaragePage() {
  const profile = useSessionStore((s) => s.profile);
  const [cars, setCars] = useState<CarWithUpgrades[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const credits = Number(profile?.credits ?? 0);

  const load = useCallback(async () => {
    try {
      const data = await api.garage.cars();
      setCars(data);
      if (!selected && data.length > 0) setSelected(data[0]!.id);
    } catch {
      // API offline — show empty state
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => { void load(); }, [load]);

  const selectedCar = cars.find((c) => c.id === selected);

  return (
    <main className="min-h-screen pt-20 px-6 pb-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl text-neon-cyan">GARAGE</h1>
            <p className="text-white/40 text-sm mt-1">
              {profile ? (
                <>Balance: <span className="text-neon-volt font-display">₵{credits.toLocaleString()}</span></>
              ) : (
                "Connect to the API to see your fleet"
              )}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="font-display text-neon-cyan/40 animate-pulse pt-20 text-center">LOADING FLEET…</div>
        ) : cars.length === 0 ? (
          <HoloCard className="p-10 text-center space-y-4">
            <div className="font-display text-2xl text-white/30">NO CARS</div>
            <p className="text-white/30 text-sm">Start a race to receive your starter vehicle.</p>
          </HoloCard>
        ) : (
          <div className="grid grid-cols-[280px_1fr] gap-6">
            {/* Fleet list */}
            <div className="space-y-3">
              {cars.map((car) => (
                <CarCard
                  key={car.id}
                  car={car}
                  selected={car.id === selected}
                  onSelect={() => setSelected(car.id)}
                />
              ))}
            </div>

            {/* Upgrade panel */}
            <HoloCard className="p-6">
              {selectedCar ? (
                <UpgradePanel
                  car={selectedCar}
                  credits={credits}
                  onPurchased={async () => {
                    await load();
                    const me = await api.players.me().catch(() => null);
                    if (me) useSessionStore.getState().setProfile(me);
                  }}
                />
              ) : (
                <div className="font-display text-white/20 pt-8 text-center">SELECT A CAR</div>
              )}
            </HoloCard>
          </div>
        )}
      </div>
    </main>
  );
}
