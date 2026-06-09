/**
 * Static car catalog. Each model has a handling profile that multiplies the
 * base constants from physics.ts — same class ceiling for all cars, different
 * feel curves. Upgrades are additive modifiers on top of these multipliers,
 * so the catalog is the feel and upgrades are the power budget.
 */

import type { CarClass, UpgradeSlot } from "./domain.js";

export interface HandlingProfile {
  /** engine force multiplier */
  engineMult: number;
  /** lateral grip multiplier */
  gripMult: number;
  /** drag coefficient multiplier (lower = higher top speed) */
  dragMult: number;
  /** how quickly the car enters a drift — handbrakeGripFactor multiplier */
  driftEntryMult: number;
  /** nitro boost multiplier */
  nitroMult: number;
}

export interface CarModel {
  key: string;
  name: string;
  carClass: CarClass;
  description: string;
  accentColor: string;
  underglowColor: string;
  /** Geometry descriptor for the visual layer (replaces placeholder box later). */
  geometry: "sedan" | "hatchback" | "muscle" | "supercar" | "van";
  handling: HandlingProfile;
}

const NEUTRAL: HandlingProfile = {
  engineMult: 1,
  gripMult: 1,
  dragMult: 1,
  driftEntryMult: 1,
  nitroMult: 1,
};

export const CAR_CATALOG: Record<string, CarModel> = {
  // ── Class D (starters) ──────────────────────────────────────────────────
  "d-phantom-hatch": {
    key: "d-phantom-hatch",
    name: "Phantom Hatch",
    carClass: "D",
    description: "Nimble and forgiving. Bleeds grip fast — perfect for learning to drift.",
    accentColor: "#00f0ff",
    underglowColor: "#004455",
    geometry: "hatchback",
    handling: { ...NEUTRAL, gripMult: 0.88, driftEntryMult: 1.2, engineMult: 0.85 },
  },
  "d-circuit-sedan": {
    key: "d-circuit-sedan",
    name: "Circuit Sedan",
    carClass: "D",
    description: "High grip, low drama. Ideal for learning the lines.",
    accentColor: "#ff2e97",
    underglowColor: "#44002a",
    geometry: "sedan",
    handling: { ...NEUTRAL, gripMult: 1.1, driftEntryMult: 0.85, engineMult: 0.9 },
  },
  // ── Class C ─────────────────────────────────────────────────────────────
  "c-neon-runner": {
    key: "c-neon-runner",
    name: "Neon Runner",
    carClass: "C",
    description: "The street racer archetype — balanced, upgradeable, community favourite.",
    accentColor: "#ccff00",
    underglowColor: "#223300",
    geometry: "sedan",
    handling: { ...NEUTRAL },
  },
  "c-wraith-muscle": {
    key: "c-wraith-muscle",
    name: "Wraith Muscle",
    carClass: "C",
    description: "Raw torque, loose rear — commit to the angle or spin.",
    accentColor: "#ff2e97",
    underglowColor: "#330011",
    geometry: "muscle",
    handling: { ...NEUTRAL, engineMult: 1.18, gripMult: 0.85, driftEntryMult: 1.3, dragMult: 1.05 },
  },
  // ── Class B ─────────────────────────────────────────────────────────────
  "b-apex-coupe": {
    key: "b-apex-coupe",
    name: "Apex Coupe",
    carClass: "B",
    description: "Surgical precision at speed. Rewards smooth inputs.",
    accentColor: "#00f0ff",
    underglowColor: "#001833",
    geometry: "supercar",
    handling: { ...NEUTRAL, gripMult: 1.12, engineMult: 1.1, dragMult: 0.9, driftEntryMult: 0.9 },
  },
  "b-drifter-van": {
    key: "b-drifter-van",
    name: "Drifter Van",
    carClass: "B",
    description: "Meme or menace? Absurd drift chains, terrible top speed.",
    accentColor: "#ccff00",
    underglowColor: "#112200",
    geometry: "van",
    handling: { ...NEUTRAL, engineMult: 0.8, gripMult: 0.72, driftEntryMult: 1.8, dragMult: 1.15, nitroMult: 1.1 },
  },
  // ── Class A ─────────────────────────────────────────────────────────────
  "a-syndicate-gt": {
    key: "a-syndicate-gt",
    name: "Syndicate GT",
    carClass: "A",
    description: "Faction-preferred. Fast, stable, intimidating.",
    accentColor: "#ff2e97",
    underglowColor: "#220011",
    geometry: "supercar",
    handling: { ...NEUTRAL, engineMult: 1.22, gripMult: 1.08, dragMult: 0.88, nitroMult: 1.12 },
  },
  // ── Class S ─────────────────────────────────────────────────────────────
  "s-ghost-zero": {
    key: "s-ghost-zero",
    name: "Ghost Zero",
    carClass: "S",
    description: "Mythical. Earnable only. The car Neo-Meridian legends drive.",
    accentColor: "#ffffff",
    underglowColor: "#334455",
    geometry: "supercar",
    handling: {
      engineMult: 1.38,
      gripMult: 1.15,
      dragMult: 0.78,
      driftEntryMult: 1.1,
      nitroMult: 1.25,
    },
  },
};

// ── Upgrade modifiers ──────────────────────────────────────────────────────
// Each tier adds the delta to the corresponding handling param.
// Tier 0 = stock. Tier 5 = maxed. Applied on top of the model's base profile.

type SlotMods = Partial<HandlingProfile>;

const ENGINE: SlotMods[] = [
  {},
  { engineMult: 0.04 },
  { engineMult: 0.09 },
  { engineMult: 0.15 },
  { engineMult: 0.22 },
  { engineMult: 0.30 },
];

const TRANSMISSION: SlotMods[] = [
  {},
  { dragMult: -0.02 },
  { dragMult: -0.04 },
  { dragMult: -0.07 },
  { dragMult: -0.10 },
  { dragMult: -0.14 },
];

const TIRES: SlotMods[] = [
  {},
  { gripMult: 0.03 },
  { gripMult: 0.07 },
  { gripMult: 0.11 },
  { gripMult: 0.16 },
  { gripMult: 0.22 },
];

const NITRO_UP: SlotMods[] = [
  {},
  { nitroMult: 0.04 },
  { nitroMult: 0.09 },
  { nitroMult: 0.14 },
  { nitroMult: 0.20 },
  { nitroMult: 0.27 },
];

const ECU: SlotMods[] = [
  {},
  { engineMult: 0.02, dragMult: -0.01 },
  { engineMult: 0.04, dragMult: -0.02 },
  { engineMult: 0.06, dragMult: -0.04 },
  { engineMult: 0.09, dragMult: -0.06 },
  { engineMult: 0.12, dragMult: -0.09 },
];

const WEIGHT: SlotMods[] = [
  {},
  { gripMult: 0.02, engineMult: 0.01 },
  { gripMult: 0.04, engineMult: 0.02 },
  { gripMult: 0.06, engineMult: 0.04 },
  { gripMult: 0.09, engineMult: 0.06 },
  { gripMult: 0.13, engineMult: 0.08 },
];

const UPGRADE_TABLES: Record<UpgradeSlot, SlotMods[]> = {
  ENGINE,
  TRANSMISSION,
  TIRES,
  NITRO: NITRO_UP,
  ECU,
  WEIGHT,
};

/** Resolve a car's effective handling profile given its current upgrades. */
export function resolveHandling(
  modelKey: string,
  upgrades: Partial<Record<UpgradeSlot, number>>,
): HandlingProfile {
  const model = CAR_CATALOG[modelKey];
  if (!model) throw new Error(`unknown car model: ${modelKey}`);

  const p = { ...model.handling };
  for (const [slot, tier] of Object.entries(upgrades) as [UpgradeSlot, number][]) {
    const mods = UPGRADE_TABLES[slot][tier];
    if (!mods) continue;
    for (const [k, delta] of Object.entries(mods) as [keyof SlotMods, number][]) {
      (p[k] as number) += delta;
    }
  }
  return p;
}

/** Credits cost to upgrade a slot from (tier-1) to tier. */
export function upgradeCost(slot: UpgradeSlot, tier: number): bigint {
  if (tier < 1 || tier > 5) throw new RangeError("tier must be 1–5");
  const BASE: Record<UpgradeSlot, bigint> = {
    ENGINE: 800n,
    TRANSMISSION: 600n,
    TIRES: 700n,
    NITRO: 750n,
    ECU: 900n,
    WEIGHT: 650n,
  };
  return BASE[slot] * BigInt(tier) * BigInt(tier);
}

/** Starter car granted to every new player. */
export const STARTER_CAR_KEY = "d-phantom-hatch";
