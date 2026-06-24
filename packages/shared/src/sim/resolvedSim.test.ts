import { describe, expect, it } from "vitest";
import { createCarState, stepCar, type CarInput } from "./carSim.js";
import { stepCarResolved } from "./resolvedSim.js";
import { NEUTRAL_HANDLING, resolveHandling, STARTER_CAR_KEY } from "../catalog.js";

const THROTTLE: CarInput = { steer: 0, throttle: 1, brake: 0, handbrake: false, nitro: false };
const DRIFT_IN: CarInput = { steer: 1, throttle: 0.8, brake: 0, handbrake: true, nitro: false };

describe("stepCarResolved", () => {
  it("with the neutral profile is bit-identical to stepCar (reconciliation invariant)", () => {
    const a = createCarState(0, 0, 0.3);
    const b = createCarState(0, 0, 0.3);
    for (let i = 0; i < 600; i++) {
      const input = i % 90 < 60 ? THROTTLE : DRIFT_IN;
      stepCar(a, input);
      stepCarResolved(b, input, NEUTRAL_HANDLING);
    }
    expect(b).toStrictEqual(a); // exact float equality — determinism is the contract
  });

  it("is deterministic across runs for an upgraded car", () => {
    const profile = resolveHandling(STARTER_CAR_KEY, { ENGINE: 3, TIRES: 2, NITRO: 1 });
    const run = () => {
      const s = createCarState(0, 0, 0);
      for (let i = 0; i < 300; i++) stepCarResolved(s, i % 60 < 45 ? THROTTLE : DRIFT_IN, profile);
      return s;
    };
    expect(run()).toStrictEqual(run());
  });

  it("engine upgrades make the car measurably faster", () => {
    const stock = resolveHandling(STARTER_CAR_KEY, {});
    const tuned = resolveHandling(STARTER_CAR_KEY, { ENGINE: 5, TRANSMISSION: 5, ECU: 5 });
    const speedAfter = (profile: typeof stock) => {
      const s = createCarState(0, 0, 0);
      for (let i = 0; i < 150; i++) stepCarResolved(s, THROTTLE, profile); // 5s flat-out
      return Math.hypot(s.vx, s.vz);
    };
    expect(speedAfter(tuned)).toBeGreaterThan(speedAfter(stock) * 1.1);
  });

  it("different catalog models produce different handling", () => {
    const muscle = resolveHandling("c-wraith-muscle", {});
    const sedan = resolveHandling("d-circuit-sedan", {});
    const slipAfter = (profile: typeof muscle) => {
      const s = createCarState(0, 0, 0);
      for (let i = 0; i < 90; i++) stepCarResolved(s, THROTTLE, profile);
      for (let i = 0; i < 30; i++) stepCarResolved(s, DRIFT_IN, profile);
      const fwd = s.vx * Math.sin(s.yaw) + s.vz * Math.cos(s.yaw);
      const lat = s.vx * Math.cos(s.yaw) - s.vz * Math.sin(s.yaw);
      return Math.abs(Math.atan2(lat, Math.abs(fwd) + 0.01));
    };
    // The loose-rear muscle car holds a bigger slip angle than the grippy sedan.
    expect(slipAfter(muscle)).toBeGreaterThan(slipAfter(sedan));
  });

  it("resolveHandling ignores junk slots and tiers from untrusted tickets", () => {
    const clean = resolveHandling(STARTER_CAR_KEY, {});
    const dirty = resolveHandling(STARTER_CAR_KEY, {
      BOGUS: 3,
      ENGINE: 99,
    } as never);
    expect(dirty).toStrictEqual(clean);
  });
});
