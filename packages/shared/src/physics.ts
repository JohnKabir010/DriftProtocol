/**
 * Arcade car-handling constants shared by client prediction and server authority.
 * Both sides MUST simulate with identical values at the same fixed tick rate,
 * or reconciliation will fight the player. Tuning lives here, never inline.
 */

export const SIM_TICK_RATE = 30; // Hz — fixed-step simulation on client & server
export const SIM_DT = 1 / SIM_TICK_RATE;
export const SNAPSHOT_RATE = 15; // Hz — server → client state broadcasts
export const INTERP_DELAY_MS = 120; // remote-entity interpolation buffer

/** Baseline class-C handling profile. Per-car/upgrade modifiers multiply these. */
export const BASE_CAR = {
  mass: 1200, // kg
  engineForce: 16000, // N at full throttle
  brakeForce: 22000, // N
  maxSpeed: 62, // m/s (~223 km/h)
  /** Speed-sensitive steering: max wheel angle scales down with velocity. */
  steerAngleLowSpeed: 0.55, // rad
  steerAngleHighSpeed: 0.18, // rad
  lateralGrip: 9.5, // slip-curve peak coefficient
  /** Grip multiplier while handbrake is held — the drift entry lever.
   * Steady-state slip ≈ atan(vR/vF); this value puts a full-lock handbrake
   * turn at ~25° slip, inside the [15°, 65°] drift-scoring window. */
  handbrakeGripFactor: 0.22,
  downforcePerSpeed: 18, // N per m/s
  /** Quadratic drag (m/s² per (m/s)²): sets the natural top speed. */
  dragCoeff: 0.0035,
  /** Constant rolling resistance, m/s². */
  rollingResist: 0.8,
  /** Steering responsiveness multiplier (yaw rate = steer × angle × gain). */
  steerGain: 2.0,
  /** Extra yaw authority while the handbrake is down (drift initiation). */
  handbrakeYawBoost: 1.6,
} as const;

export const NITRO = {
  bottles: 3,
  boostAccelMultiplier: 1.35,
  boostDurationMs: 2500,
  /** Drift score required to bank one bottle. */
  chargePerBottle: 1500,
} as const;

export const DRIFT = {
  minSlipAngleRad: 0.26, // ~15° — below this, no drift credit
  maxSlipAngleRad: 1.13, // ~65° — beyond this it's a spin, chain drops
  /** Points per second = speed(m/s) × angle(rad) × this. */
  scoreRate: 14,
  chainBankGraceMs: 600, // straighten window before the chain banks
} as const;
