"use client";

import { useCallback, useEffect, useState } from "react";
import { CAR_CATALOG } from "@drift/shared";
import { api, type CarWithUpgrades, type MarketListingRow } from "@/lib/api";
import { useSessionStore } from "@/stores/sessionStore";
import { HoloCard } from "@/components/ui/HoloCard";
import { NeonButton } from "@/components/ui/NeonButton";

const TIER_COLORS: Record<string, string> = {
  LEGEND: "text-neon-volt",
  SYNDICATE: "text-neon-magenta",
  UNDERGROUND: "text-neon-cyan",
  STREET: "text-white/50",
};

function ListingCard({
  listing,
  isOwn,
  credits,
  onAction,
}: {
  listing: MarketListingRow;
  isOwn: boolean;
  credits: number;
  onAction: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const price = Number(listing.price);
  const model = listing.carModel;
  const accent = model?.accentColor ?? "#00f0ff";

  async function act() {
    setBusy(true);
    try {
      if (isOwn) await api.market.cancel(listing.id);
      else await api.market.buy(listing.id);
      onAction();
    } catch {}
    finally { setBusy(false); }
  }

  return (
    <HoloCard className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-display text-[10px] px-1.5 py-0.5 border" style={{ color: accent, borderColor: `${accent}40` }}>
          {model ? `CLASS ${model.carClass}` : listing.assetType}
        </span>
        <span className={`font-display text-[10px] ${TIER_COLORS[listing.seller.repTier] ?? ""}`}>
          {listing.seller.repTier}
        </span>
      </div>

      <div>
        <div className="font-display text-base text-white">{model?.name ?? listing.assetRef.slice(0, 8)}</div>
        <div className="text-white/40 text-xs">by {listing.seller.handle}</div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="font-display text-lg text-neon-volt">₵{price.toLocaleString()}</div>
        {isOwn ? (
          <NeonButton size="sm" variant="magenta" onClick={act} disabled={busy}>
            {busy ? "…" : "CANCEL"}
          </NeonButton>
        ) : (
          <NeonButton size="sm" variant="cyan" onClick={act} disabled={busy || credits < price}>
            {busy ? "…" : credits < price ? "LOW ₵" : "BUY"}
          </NeonButton>
        )}
      </div>
    </HoloCard>
  );
}

function ListCarModal({ onClose, onListed }: { onClose: () => void; onListed: () => void }) {
  const [cars, setCars] = useState<CarWithUpgrades[]>([]);
  const [selectedCar, setSelectedCar] = useState<string>("");
  const [price, setPrice] = useState("500");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.garage.cars().then(setCars).catch(() => {}); }, []);

  async function submit() {
    if (!selectedCar || !price) return;
    setError("");
    setBusy(true);
    try {
      await api.market.list(selectedCar, parseInt(price));
      onListed();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-void/80 backdrop-blur-sm z-50 grid place-items-center pointer-events-auto">
      <HoloCard className="p-8 w-96 space-y-5" glow="magenta">
        <h2 className="font-display text-xl text-neon-magenta">LIST CAR FOR SALE</h2>
        <p className="text-white/40 text-xs">2.5% fee on sale. Listing can be cancelled anytime.</p>
        <div className="space-y-4">
          <div>
            <label className="font-display text-[10px] text-white/40 tracking-widest">SELECT CAR</label>
            <select
              value={selectedCar}
              onChange={(e) => setSelectedCar(e.target.value)}
              className="mt-1 w-full bg-white/5 border border-neon-cyan/20 text-white font-display text-sm px-3 py-2 focus:outline-none"
            >
              <option value="">— choose —</option>
              {cars.map((c) => {
                const model = CAR_CATALOG[c.modelKey];
                return (
                  <option key={c.id} value={c.id}>
                    {model?.name ?? c.modelKey} (Class {c.carClass})
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="font-display text-[10px] text-white/40 tracking-widest">PRICE (₵ CREDITS)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              min={100}
              className="mt-1 w-full bg-white/5 border border-neon-cyan/20 text-neon-volt font-display text-sm px-3 py-2 focus:outline-none"
            />
          </div>
        </div>
        {error && <p className="font-display text-xs text-neon-danger">{error}</p>}
        <div className="flex gap-3 pt-2">
          <NeonButton variant="magenta" onClick={submit} disabled={busy || !selectedCar}>
            {busy ? "LISTING…" : "LIST CAR"}
          </NeonButton>
          <NeonButton variant="cyan" onClick={onClose}>CANCEL</NeonButton>
        </div>
      </HoloCard>
    </div>
  );
}

export default function MarketPage() {
  const profile = useSessionStore((s) => s.profile);
  const [listings, setListings] = useState<MarketListingRow[]>([]);
  const [mine, setMine] = useState<MarketListingRow[]>([]);
  const [tab, setTab] = useState<"browse" | "mine">("browse");
  const [listing, setListing] = useState(false);
  const [loading, setLoading] = useState(true);
  const credits = Number(profile?.credits ?? 0);

  const load = useCallback(async () => {
    try {
      const [all, my] = await Promise.all([
        api.market.browse(),
        api.market.mine().catch(() => []),
      ]);
      setListings(all);
      setMine(my);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const displayed = tab === "browse" ? listings : mine;

  return (
    <main className="min-h-screen pt-20 px-6 pb-10">
      {listing && <ListCarModal onClose={() => setListing(false)} onListed={load} />}
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl text-neon-cyan">MARKETPLACE</h1>
            <p className="text-white/40 text-sm mt-1">
              Credits only · 2.5% fee · Your balance:{" "}
              <span className="text-neon-volt font-display">₵{credits.toLocaleString()}</span>
            </p>
          </div>
          <NeonButton variant="magenta" onClick={() => setListing(true)}>
            SELL A CAR
          </NeonButton>
        </div>

        <div className="flex gap-1">
          {(["browse", "mine"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`font-display text-xs tracking-widest px-5 py-2 transition-colors border ${
                tab === t
                  ? "text-neon-cyan border-neon-cyan/40 bg-neon-cyan/10"
                  : "text-white/40 border-white/10 hover:text-white/70"
              }`}
            >
              {t === "browse" ? "BROWSE" : `MY LISTINGS (${mine.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="font-display text-neon-cyan/40 animate-pulse pt-20 text-center">LOADING LISTINGS…</div>
        ) : displayed.length === 0 ? (
          <HoloCard className="p-10 text-center">
            <p className="font-display text-white/20">
              {tab === "browse" ? "No listings yet — be the first to sell." : "You have no active listings."}
            </p>
          </HoloCard>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {displayed.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                isOwn={tab === "mine" || mine.some((m) => m.id === l.id)}
                credits={credits}
                onAction={load}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
