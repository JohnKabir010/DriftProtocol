/**
 * Thin wrapper that applies a resolved HandlingProfile on top of BASE_CAR
 * before stepping the sim. Both the server (from DB upgrades) and the client
 * (from garage store) call this — same formula, same result.
 */

import { BASE_CAR, DRIFT, NITRO, SIM_DT } from "../physics.js";
import type { HandlingProfile } from "../catalog.js";
import { bankDrift, type CarInput, type CarSimState } from "./carSim.js";

/** Step the car using upgrade-modified constants. Pure function — no side effects. */
export function stepCarResolved(
  s: CarSimState,
  input: CarInput,
  h: HandlingProfile,
  dt: number = SIM_DT,
): CarSimState {
  const engineForce = BASE_CAR.engineForce * h.engineMult;
  const lateralGrip = BASE_CAR.lateralGrip * h.gripMult;
  const dragCoeff = BASE_CAR.dragCoeff * h.dragMult;
  const handbrakeGrip = BASE_CAR.handbrakeGripFactor * h.driftEntryMult;
  const boostMult = NITRO.boostAccelMultiplier * h.nitroMult;

  // ── Nitro ─────────────────────────────────────────────────────────────
  if (input.nitro && s.nitroMs <= 0 && s.bottles > 0) {
    s.bottles -= 1;
    s.nitroMs = NITRO.boostDurationMs;
  } else {
    s.nitroMs = Math.max(0, s.nitroMs - dt * 1000);
  }

  // ── Steering ──────────────────────────────────────────────────────────
  const speed = Math.hypot(s.vx, s.vz);
  const speedNorm = Math.min(speed / BASE_CAR.maxSpeed, 1);
  const steerAngle =
    BASE_CAR.steerAngleLowSpeed +
    (BASE_CAR.steerAngleHighSpeed - BASE_CAR.steerAngleLowSpeed) * speedNorm;
  const steerAuth = Math.min(speed / 12, 1) * (input.handbrake ? BASE_CAR.handbrakeYawBoost : 1);
  s.yaw += input.steer * steerAngle * BASE_CAR.steerGain * steerAuth * dt;

  // ── Body frame decomposition ───────────────────────────────────────────
  const fwdX = Math.sin(s.yaw);
  const fwdZ = Math.cos(s.yaw);
  const rightX = fwdZ;
  const rightZ = -fwdX;
  let vF = s.vx * fwdX + s.vz * fwdZ;
  let vR = s.vx * rightX + s.vz * rightZ;

  // ── Lateral grip ──────────────────────────────────────────────────────
  const grip = lateralGrip * (input.handbrake ? handbrakeGrip : 1);
  vR *= Math.exp(-grip * dt);

  // ── Longitudinal ──────────────────────────────────────────────────────
  const boosting = s.nitroMs > 0;
  const accel = input.throttle * (engineForce / BASE_CAR.mass) * (boosting ? boostMult : 1);
  const drag = dragCoeff * vF * Math.abs(vF) * (boosting ? 0.5 : 1);
  vF += (accel - drag) * dt;

  const brakeStep = input.brake * (BASE_CAR.brakeForce / BASE_CAR.mass) * dt;
  vF = vF > 0 ? Math.max(0, vF - brakeStep) : Math.min(0, vF + brakeStep);
  const rollStep = BASE_CAR.rollingResist * dt;
  vF = vF > 0 ? Math.max(0, vF - rollStep) : Math.min(0, vF + rollStep);
  vF = Math.min(vF, BASE_CAR.maxSpeed * (boosting ? 1.12 : 1));

  // ── Drift ─────────────────────────────────────────────────────────────
  const newSpeed = Math.hypot(vF, vR);
  const slip = Math.atan2(Math.abs(vR), Math.abs(vF) + 0.01);
  const inWindow = newSpeed > 8 && slip >= DRIFT.minSlipAngleRad && slip <= DRIFT.maxSlipAngleRad;

  if (inWindow) {
    s.drifting = true;
    s.driftGraceMs = 0;
    s.driftChain += newSpeed * slip * DRIFT.scoreRate * dt;
  } else if (slip > DRIFT.maxSlipAngleRad && newSpeed > 8) {
    s.drifting = false;
    s.driftChain = 0;
    s.driftGraceMs = 0;
  } else if (s.drifting || s.driftChain > 0) {
    s.driftGraceMs += dt * 1000;
    if (s.driftGraceMs >= DRIFT.chainBankGraceMs) bankDrift(s);
  }

  // ── Integrate ─────────────────────────────────────────────────────────
  s.vx = vF * fwdX + vR * rightX;
  s.vz = vF * fwdZ + vR * rightZ;
  s.x += s.vx * dt;
  s.z += s.vz * dt;
  return s;
}
