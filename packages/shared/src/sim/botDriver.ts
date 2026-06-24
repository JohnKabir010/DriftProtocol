/**
 * Deterministic bot driver: pure-pursuit steering along the track centerline
 * with curvature-based speed control. No randomness — a bot's behavior is a
 * pure function of (track, car state, profile, tick), so server-side replays
 * and re-simulations reproduce bot races exactly.
 */

import { BASE_CAR } from "../physics.js";
import type { CarInput, CarSimState } from "./carSim.js";
import { angleDelta } from "./netcode.js";
import { poseAtS, trackQuery, type Track } from "./track.js";

export interface BotProfile {
  /** Display name shown in lobbies and results. */
  handle: string;
  /** Fraction of the corner-limited target speed the bot drives at. */
  speedFactor: number;
  /** Pure-pursuit lookahead scale — lower = tighter lines, twitchier. */
  lookaheadFactor: number;
  /** Ticks between nitro re-evaluations (staggers boosts between bots). */
  nitroPeriod: number;
}

/** Fixed roster — index-stable so a grid slot always gets the same driver. */
export const BOT_PROFILES: readonly BotProfile[] = [
  { handle: "BOT·VEC-7", speedFactor: 0.93, lookaheadFactor: 1.0, nitroPeriod: 211 },
  { handle: "BOT·NULLDRIVE", speedFactor: 0.88, lookaheadFactor: 1.15, nitroPeriod: 173 },
  { handle: "BOT·KIRIN", speedFactor: 0.84, lookaheadFactor: 0.9, nitroPeriod: 251 },
  { handle: "BOT·GHOSTLINE", speedFactor: 0.8, lookaheadFactor: 1.25, nitroPeriod: 307 },
];

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/** Compute this tick's input for a bot. Pure — no internal state. */
export function botInput(
  track: Track,
  sim: CarSimState,
  profile: BotProfile,
  tick: number,
): CarInput {
  const speed = Math.hypot(sim.vx, sim.vz);
  const q = trackQuery(track, sim.x, sim.z);

  // Aim at a point ahead on the centerline; lookahead grows with speed so
  // fast bots cut smooth arcs instead of oscillating.
  const lookahead = (6 + speed * 0.45) * profile.lookaheadFactor;
  const target = poseAtS(track, q.s + lookahead);
  const targetYaw = Math.atan2(target.x - sim.x, target.z - sim.z);
  const steer = clamp(angleDelta(targetYaw, sim.yaw) * 2.2, -1, 1);

  // Corner severity ahead: heading change across the next stretch of track.
  const near = poseAtS(track, q.s + 12);
  const far = poseAtS(track, q.s + 34);
  const curve = Math.abs(angleDelta(far.yaw, near.yaw));
  const cornerLimit = curve > 0.85 ? 0.38 : curve > 0.45 ? 0.55 : curve > 0.2 ? 0.75 : 1;
  const targetSpeed = BASE_CAR.maxSpeed * cornerLimit * profile.speedFactor;

  const throttle = speed < targetSpeed ? 1 : 0;
  const brake = speed > targetSpeed * 1.18 ? 0.7 : 0;

  // Boost on straights, staggered by the profile's prime-numbered period.
  const nitro = curve < 0.12 && speed > 20 && tick % profile.nitroPeriod === 0;

  return { steer, throttle, brake, handbrake: false, nitro };
}
