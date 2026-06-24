import { describe, it, expect } from "vitest";
import { CAR_CATALOG, NEUTRAL_HANDLING, upgradeCost, resolveHandling } from "./catalog.js";

describe("CAR_CATALOG", () => {
  it("contains at least 8 car models", () => {
    expect(Object.keys(CAR_CATALOG).length).toBeGreaterThanOrEqual(8);
  });

  it("every model has required fields", () => {
    for (const [key, model] of Object.entries(CAR_CATALOG)) {
      expect(model.key).toBe(key);
      expect(model.name).toBeTruthy();
      expect(["D", "C", "B", "A", "S"]).toContain(model.carClass);
      expect(model.handling).toBeDefined();
      expect(typeof model.handling.engineMult).toBe("number");
      expect(typeof model.handling.gripMult).toBe("number");
    }
  });

  it("NEUTRAL_HANDLING is the all-ones identity profile", () => {
    expect(NEUTRAL_HANDLING.engineMult).toBe(1);
    expect(NEUTRAL_HANDLING.gripMult).toBe(1);
    expect(NEUTRAL_HANDLING.dragMult).toBe(1);
    expect(NEUTRAL_HANDLING.driftEntryMult).toBe(1);
    expect(NEUTRAL_HANDLING.nitroMult).toBe(1);
  });

  it("Class D cars have engineMult < 1 (lower power ceiling)", () => {
    const dCars = Object.values(CAR_CATALOG).filter((c) => c.carClass === "D");
    for (const car of dCars) {
      expect(car.handling.engineMult).toBeLessThanOrEqual(1);
    }
  });
});

describe("upgradeCost", () => {
  it("returns a positive bigint for tier 1", () => {
    const cost = upgradeCost("ENGINE", 1);
    expect(typeof cost).toBe("bigint");
    expect(cost).toBeGreaterThan(0n);
  });

  it("tier 5 costs more than tier 1", () => {
    const t1 = upgradeCost("ENGINE", 1);
    const t5 = upgradeCost("ENGINE", 5);
    expect(t5).toBeGreaterThan(t1);
  });

  it("same tier costs the same across runs (deterministic)", () => {
    expect(upgradeCost("TIRES", 3)).toBe(upgradeCost("TIRES", 3));
  });

  it("all 6 slots have defined costs at all tiers", () => {
    const slots = ["ENGINE", "TRANSMISSION", "TIRES", "NITRO", "ECU", "WEIGHT"] as const;
    for (const slot of slots) {
      for (let tier = 1; tier <= 5; tier++) {
        expect(upgradeCost(slot, tier)).toBeGreaterThan(0n);
      }
    }
  });
});

describe("resolveHandling", () => {
  it("returns identity profile for stock car with no upgrades", () => {
    const profile = resolveHandling("c-neon-runner", {});
    const base = CAR_CATALOG["c-neon-runner"]!.handling;
    expect(profile.engineMult).toBeCloseTo(base.engineMult);
    expect(profile.gripMult).toBeCloseTo(base.gripMult);
  });

  it("ENGINE tier 5 raises engineMult above stock", () => {
    const stock = resolveHandling("c-neon-runner", {});
    const maxed = resolveHandling("c-neon-runner", { ENGINE: 5 });
    expect(maxed.engineMult).toBeGreaterThan(stock.engineMult);
  });

  it("throws for an unknown modelKey", () => {
    expect(() => resolveHandling("nonexistent-car", {})).toThrow("unknown car model");
  });
});
