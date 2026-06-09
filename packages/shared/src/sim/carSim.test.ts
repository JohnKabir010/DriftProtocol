import { describe, expect, it } from "vitest";
import {
  bankDrift,
  carSpeed,
  clampInput,
  cloneCarState,
  createCarState,
  stepCar,
} from "./carSim.js";
import { NITRO } from "../physics.js";

/** Deterministic LCG so both "machines" replay the identical input tape. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

describe("car simulation", () => {
  it("is deterministic: same input tape produces bit-identical state", () => {
    const rng = makeRng(42);
    const tape = Array.from({ length: 600 }, () => ({
      steer: rng() * 2 - 1,
      throttle: rng(),
      brake: rng() > 0.8 ? rng() : 0,
      handbrake: rng() > 0.7,
      nitro: rng() > 0.9,
    }));

    const a = createCarState(0, 0, 0);
    const b = createCarState(0, 0, 0);
    for (const input of tape) stepCar(a, input);
    for (const input of tape) stepCar(b, input);

    expect(a).toStrictEqual(b);
  });

  it("accelerates under throttle and stops under braking", () => {
    const car = createCarState(0, 0, 0);
    for (let i = 0; i < 90; i++) stepCar(car, { steer: 0, throttle: 1, brake: 0, handbrake: false, nitro: false });
    expect(carSpeed(car)).toBeGreaterThan(20);
    expect(car.z).toBeGreaterThan(10); // yaw=0 means +Z travel

    for (let i = 0; i < 300; i++) stepCar(car, { steer: 0, throttle: 0, brake: 1, handbrake: false, nitro: false });
    expect(carSpeed(car)).toBe(0);
  });

  it("consumes a nitro bottle and boosts top speed", () => {
    const car = createCarState(0, 0, 0);
    for (let i = 0; i < 300; i++) stepCar(car, { steer: 0, throttle: 1, brake: 0, handbrake: false, nitro: false });
    const cruise = carSpeed(car);

    stepCar(car, { steer: 0, throttle: 1, brake: 0, handbrake: false, nitro: true });
    expect(car.bottles).toBe(NITRO.bottles - 1);
    for (let i = 0; i < 60; i++) stepCar(car, { steer: 0, throttle: 1, brake: 0, handbrake: false, nitro: false });
    expect(carSpeed(car)).toBeGreaterThan(cruise);
  });

  it("builds a drift chain in a handbrake turn and banks it on straighten", () => {
    const car = createCarState(0, 0, 0);
    // Get up to speed.
    for (let i = 0; i < 120; i++) stepCar(car, { steer: 0, throttle: 1, brake: 0, handbrake: false, nitro: false });
    // Handbrake turn.
    for (let i = 0; i < 45; i++) stepCar(car, { steer: 1, throttle: 1, brake: 0, handbrake: true, nitro: false });
    const live = car.driftChain;
    expect(live).toBeGreaterThan(0);

    // Straighten until the grace window banks the chain.
    for (let i = 0; i < 60; i++) stepCar(car, { steer: 0, throttle: 1, brake: 0, handbrake: false, nitro: false });
    expect(car.driftChain).toBe(0);
    expect(car.driftScore).toBeGreaterThan(0);
  });

  it("bankDrift converts charge into bottles up to the cap", () => {
    const car = createCarState(0, 0, 0);
    car.bottles = 0;
    car.driftChain = NITRO.chargePerBottle * 2 + 10;
    bankDrift(car);
    expect(car.bottles).toBe(2);
    expect(car.driftScore).toBeGreaterThan(0);
  });

  it("clampInput neutralizes hostile values", () => {
    const input = clampInput({
      steer: Number.POSITIVE_INFINITY,
      throttle: 99,
      brake: NaN,
      handbrake: 1 as unknown as boolean,
      nitro: "yes" as unknown as boolean,
    });
    expect(input).toStrictEqual({ steer: 0, throttle: 1, brake: 0, handbrake: false, nitro: false });
  });

  it("cloneCarState produces an independent copy", () => {
    const a = createCarState(1, 2, 3);
    const b = cloneCarState(a);
    stepCar(b, { steer: 0, throttle: 1, brake: 0, handbrake: false, nitro: false });
    expect(a.vx).toBe(0);
    expect(a.vz).toBe(0);
  });
});
