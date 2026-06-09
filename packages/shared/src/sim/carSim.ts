/**
 * Deterministic arcade car model — the single simulation both client
 * prediction and server authority run. Pure functions, fixed timestep,
 * no engine dependencies: identical input sequences produce identical
 * states on both sides, which is what makes reconciliation trivial.
 */

import { BASE_CAR, DRIFT, NITRO, SIM_DT } from "../physics.js";

export interface CarInput {
  steer: number; // [-1, 1], +1 = left
  throttle: number; // [0, 1]
  brake: number; // [0, 1]
  handbrake: boolean;
  nitro: boolean;
}

export const NEUTRAL_INPUT: CarInput = {
  steer: 0,
  throttle: 0,
  brake: 0,
  handbrake: false,
  nitro: false,
};

export interface CarSimState {
  x: number;
  z: number;
  yaw: number; // radians, 0 = +Z
  vx: number; // world-frame velocity
  vz: number;
  nitroMs: number; // remaining boost time
  bottles: number;
  nitroCharge: number; // drift points banked toward the next bottle
  driftChain: number; // live (unbanked) chain points
  driftScore: number; // banked total for the race
  driftGraceMs: number; // time since drift window was left
  drifting: boolean;
}

export function createCarState(x: number, z: number, yaw: number): CarSimState {
  return {
    x,
    z,
    yaw,
    vx: 0,
    vz: 0,
    nitroMs: 0,
    bottles: NITRO.bottles,
    nitroCharge: 0,
    driftChain: 0,
    driftScore: 0,
    driftGraceMs: 0,
    drifting: false,
  };
}

export function cloneCarState(s: CarSimState): CarSimState {
  return { ...s };
}

/**
 * Sanitize an input frame from an untrusted source. NaN/Infinity become
 * neutral, ranges are clamped — the server never trusts client numbers.
 */
export function clampInput(raw: CarInput): CarInput {
  const num = (v: number, lo: number, hi: number): number =>
    Number.isFinite(v) ? Math.min(Math.max(v, lo), hi) : 0;
  return {
    steer: num(raw.steer, -1, 1),
    throttle: num(raw.throttle, 0, 1),
    brake: num(raw.brake, 0, 1),
    handbrake: raw.handbrake === true,
    nitro: raw.nitro === true,
  };
}

/** Advance one fixed tick. Mutates and returns `s`. */
export function stepCar(s: CarSimState, input: CarInput, dt: number = SIM_DT): CarSimState {
  const boosting = s.nitroMs > 0;

  // ── Nitro activation / countdown ─────────────────────────────────────────
  if (input.nitro && !boosting && s.bottles > 0) {
    s.bottles -= 1;
    s.nitroMs = NITRO.boostDurationMs;
  } else {
    s.nitroMs = Math.max(0, s.nitroMs - dt * 1000);
  }

  // ── Steering first: turning the body is what creates lateral slip below ──
  const speed = Math.hypot(s.vx, s.vz);
  const speedNorm = Math.min(speed / BASE_CAR.maxSpeed, 1);
  const steerAngle =
    BASE_CAR.steerAngleLowSpeed +
    (BASE_CAR.steerAngleHighSpeed - BASE_CAR.steerAngleLowSpeed) * speedNorm;
  const steerAuthority = Math.min(speed / 12, 1) * (input.handbrake ? BASE_CAR.handbrakeYawBoost : 1);
  s.yaw += input.steer * steerAngle * BASE_CAR.steerGain * steerAuthority * dt;

  // ── Decompose velocity in the NEW body frame ─────────────────────────────
  const fwdX = Math.sin(s.yaw);
  const fwdZ = Math.cos(s.yaw);
  const rightX = fwdZ;
  const rightZ = -fwdX;
  let vF = s.vx * fwdX + s.vz * fwdZ;
  let vR = s.vx * rightX + s.vz * rightZ;

  // ── Lateral grip: exponential decay of slip; handbrake loosens it ────────
  const grip = BASE_CAR.lateralGrip * (input.handbrake ? BASE_CAR.handbrakeGripFactor : 1);
  vR *= Math.exp(-grip * dt);

  // ── Longitudinal forces ──────────────────────────────────────────────────
  const engineAccel =
    input.throttle * (BASE_CAR.engineForce / BASE_CAR.mass) * (s.nitroMs > 0 ? NITRO.boostAccelMultiplier : 1);
  const dragAccel = BASE_CAR.dragCoeff * vF * Math.abs(vF) * (s.nitroMs > 0 ? 0.5 : 1);
  vF += (engineAccel - dragAccel) * dt;

  const brakeStep = input.brake * (BASE_CAR.brakeForce / BASE_CAR.mass) * dt;
  vF = vF > 0 ? Math.max(0, vF - brakeStep) : Math.min(0, vF + brakeStep);
  const rollStep = BASE_CAR.rollingResist * dt;
  vF = vF > 0 ? Math.max(0, vF - rollStep) : Math.min(0, vF + rollStep);

  const vMax = BASE_CAR.maxSpeed * (s.nitroMs > 0 ? 1.12 : 1);
  vF = Math.min(vF, vMax);

  // ── Drift detection & scoring ────────────────────────────────────────────
  const newSpeed = Math.hypot(vF, vR);
  const slip = Math.atan2(Math.abs(vR), Math.abs(vF) + 0.01);
  const inWindow = newSpeed > 8 && slip >= DRIFT.minSlipAngleRad && slip <= DRIFT.maxSlipAngleRad;

  if (inWindow) {
    s.drifting = true;
    s.driftGraceMs = 0;
    s.driftChain += newSpeed * slip * DRIFT.scoreRate * dt;
  } else if (slip > DRIFT.maxSlipAngleRad && newSpeed > 8) {
    // Spin-out: the live chain is lost, not banked.
    s.drifting = false;
    s.driftChain = 0;
    s.driftGraceMs = 0;
  } else if (s.drifting || s.driftChain > 0) {
    s.driftGraceMs += dt * 1000;
    if (s.driftGraceMs >= DRIFT.chainBankGraceMs) {
      bankDrift(s);
    }
  }

  // ── Recompose & integrate ────────────────────────────────────────────────
  s.vx = vF * fwdX + vR * rightX;
  s.vz = vF * fwdZ + vR * rightZ;
  s.x += s.vx * dt;
  s.z += s.vz * dt;
  return s;
}

/** Bank the live chain into score + nitro charge (called on straighten/finish). */
export function bankDrift(s: CarSimState): void {
  if (s.driftChain > 0) {
    s.driftScore += s.driftChain;
    s.nitroCharge += s.driftChain;
    while (s.nitroCharge >= NITRO.chargePerBottle && s.bottles < NITRO.bottles) {
      s.bottles += 1;
      s.nitroCharge -= NITRO.chargePerBottle;
    }
    // Charge can't bank past full bottles — cap so the meter stays meaningful.
    if (s.bottles >= NITRO.bottles) s.nitroCharge = Math.min(s.nitroCharge, NITRO.chargePerBottle);
  }
  s.driftChain = 0;
  s.driftGraceMs = 0;
  s.drifting = false;
}

/** Drop the live chain without banking (wall hits). */
export function dropDrift(s: CarSimState): void {
  s.driftChain = 0;
  s.driftGraceMs = 0;
  s.drifting = false;
}

export function carSpeed(s: CarSimState): number {
  return Math.hypot(s.vx, s.vz);
}
