"use client";

import { useEffect, useState, useCallback } from "react";
import { CAR_CATALOG, UpgradeSlot, upgradeCost, resolveHandling } from "@drift/shared";
import { api, type CarWithUpgrades } from "@/lib/api";
import { useSessionStore } from "@/stores/sessionStore";
import { HoloCard } from "@/components/ui/HoloCard";
import { NeonButton } from "@/components/ui/NeonButton";
import Link from "next/link";

const SLOTS: UpgradeSlot[] = ["ENGINE", "TRANSMISSION", "TIRES", "NITRO", "ECU", "WEIGHT"];
const SLOT_ICONS: Record<UpgradeSlot, string> = {
  ENGINE: "⚡", TRANSMISSION: "⚙", TIRES: "◎", NITRO: "🔥", ECU: "◈", WEIGHT: "▼",
};

function StatBar({ label, value, max = 1.5 }: { label: string; value: number; max?: number }) {
  const isHot = value > 1.0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between font-display text-[10px] text-white/60">
        <span>{label}</span>
        <span className={isHot ? "text-neon-volt" : "text-neon-cyan"}>{value.toFixed(2)}</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-neon-cyan to-neon-volt rounded-full transition-[width] duration-500"
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
      className={`holo-card p-4 text-left w-full transition-all duration-200 ${
        selected
          ? "border-neon-cyan/70 shadow-neon-cyan bg-neon-cyan/5"
          : "border-neon-cyan/15 hover:border-neon-cyan/40 hover:bg-white/[0.03]"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className="font-display text-[10px] px-2 py-0.5 rounded-sm tracking-widest"
          style={{
            color: model.accentColor,
            backgroundColor: `${model.accentColor}18`,
            border: `1px solid ${model.accentColor}40`,
          }}
        >
          CLASS {car.carClass}
        </span>
        <span className="font-display text-[10px] text-white/40">
          {car.upgrades.length}/6 SLOTS
        </span>
      </div>
      <div className="font-display text-base text-white mb-0.5">{model.name}</div>
      {car.nickname && <div className="text-xs text-white/40 italic">"{car.nickname}"</div>}
      <div className="neon-divider my-3" />
      <div className="flex gap-1.5">
        {SLOTS.map((slot) => {
          const tier = car.upgrades.find((u) => u.slot === slot)?.tier ?? 0;
          return (
            <div key={slot} className="flex flex-col gap-0.5">
              {Array.from({ length: 5 }, (_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-1.5 rounded-sm ${i < tier ? "bg-neon-volt" : "bg-white/10"}`}
                  style={i < tier ? { boxShadow: "0 0 4px #CCFF00" } : undefined}
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
    <div className="space-y-5">
      <div>
        <div className="font-display text-xl text-neon-cyan text-glow-cyan">{model.name}</div>
        <div className="font-display text-[10px] text-white/40 tracking-[0.3em] mt-1">{model.description}</div>
      </div>

      <div className="neon-divider" />

      <div className="space-y-3">
        <div className="font-display text-[10px] text-white/40 tracking-[0.4em] flex items-center gap-2">
          <span className="text-neon-cyan/60">›</span> PERFORMANCE
        </div>
        <StatBar label="ENGINE" value={handling.engineMult} />
        <StatBar label="GRIP" value={handling.gripMult} />
        <StatBar label="TOP SPEED" value={2 - handling.dragMult} />
        <StatBar label="DRIFT ENTRY" value={handling.driftEntryMult} />
        <StatBar label="NITRO" value={handling.nitroMult} />
      </div>

      <div className="neon-divider" />

      <div className="space-y-2">
        <div className="font-display text-[10px] text-white/40 tracking-[0.4em] flex items-center gap-2">
          <span className="text-neon-cyan/60">›</span> UPGRADE SLOTS
        </div>
        {SLOTS.map((slot) => {
          const tier = upgradeMap[slot] ?? 0;
          const maxed = tier >= 5;
          const cost = maxed ? null : upgradeCost(slot, tier + 1);
          const canAfford = cost === null || credits >= Number(cost);
          return (
            <div
              key={slot}
              className="holo-card px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-white/[0.04] transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base">{SLOT_ICONS[slot]}</span>
                <span className="font-display text-xs text-white/70">{slot}</span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <div
                    key={i}
                    className={`w-3 h-2 rounded-sm ${i < tier ? "bg-neon-volt" : "bg-white/10"}`}
                    style={i < tier ? { boxShadow: "0 0 4px #CCFF00" } : undefined}
                  />
                ))}
              </div>
              {maxed ? (
                <span className="font-display text-[10px] text-neon-cyan border border-neon-cyan/30 px-2 py-0.5 corner-cut-sm">
                  MAX
                </span>
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

      {error && (
        <div className="font-display text-xs text-neon-danger flex items-center gap-1.5">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}
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
      setSelected((prev) => prev ?? data[0]?.id ?? null);
    } catch {
      // API offline — show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selectedCar = cars.find((c) => c.id === selected);

  return (
    <main className="relative min-h-screen pt-20 px-6 pb-10 overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 grid-bg-sm opacity-30 pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-neon-cyan/[0.03] blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-neon-magenta/[0.03] blur-[100px] rounded-full pointer-events-none" />

      <div className="relative max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-3xl text-neon-cyan text-glow-cyan">GARAGE</h1>
            <p className="text-white/40 text-sm mt-1">
              {profile ? (
                <>
                  Balance:{" "}
                  <span className="font-display text-xl text-neon-volt">₵{credits.toLocaleString()}</span>
                </>
              ) : (
                "Connect to the API to see your fleet"
              )}
            </p>
            <div className="neon-divider mt-3 w-48" />
          </div>
        </div>

        {loading ? (
          <div className="relative pt-20 pb-20 text-center">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-neon-cyan/20 animate-pulse" />
            <div className="font-display text-neon-cyan/50 tracking-[0.3em] anim-pulse-cyan">
              LOADING FLEET ...
            </div>
          </div>
        ) : cars.length === 0 ? (
          <HoloCard className="p-12 text-center space-y-5">
            <div className="font-display text-3xl text-white/20 tracking-widest">NO CARS</div>
            <div className="neon-divider w-32 mx-auto" />
            <p className="text-white/30 text-sm">Your fleet is empty. Hit the track to claim your starter vehicle.</p>
            <div className="pt-2">
              <Link
                href="/play"
                className="inline-block font-display text-xs text-neon-cyan border border-neon-cyan/30 px-6 py-2.5 hover:bg-neon-cyan/10 transition-colors tracking-widest"
              >
                START RACING
              </Link>
            </div>
          </HoloCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
            {/* Fleet list */}
            <div className="flex md:flex-col gap-3 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
              {cars.map((car) => (
                <div key={car.id} className="flex-shrink-0 w-64 md:w-auto">
                  <CarCard
                    car={car}
                    selected={car.id === selected}
                    onSelect={() => setSelected(car.id)}
                  />
                </div>
              ))}
            </div>

            {/* Upgrade panel */}
            <HoloCard className="p-4 md:p-6">
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
                <div className="font-display text-white/20 pt-8 text-center tracking-widest">SELECT A CAR</div>
              )}
            </HoloCard>
          </div>
        )}
      </div>
    </main>
  );
}
