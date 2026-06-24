import { describe, it, expect } from "vitest";
import { clamp, lerp, wrapAngle, formatCredits, formatUsdc, DEG_TO_RAD, RAD_TO_DEG } from "./utils.js";

describe("clamp", () => {
  it("returns value when within range", () => expect(clamp(5, 0, 10)).toBe(5));
  it("clamps to min", () => expect(clamp(-3, 0, 10)).toBe(0));
  it("clamps to max", () => expect(clamp(15, 0, 10)).toBe(10));
  it("returns min when equal", () => expect(clamp(0, 0, 10)).toBe(0));
});

describe("lerp", () => {
  it("returns a at t=0", () => expect(lerp(0, 100, 0)).toBe(0));
  it("returns b at t=1", () => expect(lerp(0, 100, 1)).toBe(100));
  it("interpolates midpoint", () => expect(lerp(0, 100, 0.5)).toBe(50));
});

describe("wrapAngle", () => {
  it("keeps zero", () => expect(wrapAngle(0)).toBe(0));
  it("wraps 3π → -π", () => expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI));
  it("wraps -3π → π", () => expect(wrapAngle(-3 * Math.PI)).toBeCloseTo(Math.PI));
});

describe("angle constants", () => {
  it("DEG_TO_RAD converts 180° to π", () => expect(180 * DEG_TO_RAD).toBeCloseTo(Math.PI));
  it("RAD_TO_DEG converts π to 180°", () => expect(Math.PI * RAD_TO_DEG).toBeCloseTo(180));
});

describe("formatCredits", () => {
  it("formats zero", () => expect(formatCredits(0)).toBe("0 CR"));
  it("formats 100 minor units as 1 CR", () => expect(formatCredits(100)).toBe("1 CR"));
  it("formats bigint", () => expect(formatCredits(123_400n)).toBe("1,234 CR"));
});

describe("formatUsdc", () => {
  it("formats 10_000_000 as $1.00 USDC", () => expect(formatUsdc(10_000_000)).toBe("$1.00 USDC"));
  it("formats bigint", () => expect(formatUsdc(100_000_000n)).toBe("$10.00 USDC"));
});
