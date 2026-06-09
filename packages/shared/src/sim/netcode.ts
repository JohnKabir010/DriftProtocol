/**
 * Client-side netcode primitives: input prediction with server
 * reconciliation for the local car, and snapshot interpolation for remote
 * cars. Pure logic (no transport, no rendering) so it's unit-testable.
 */

import { CarInput, CarSimState, cloneCarState, stepCar } from "./carSim.js";
import { collideWithWalls, Track } from "./track.js";

interface PredictedFrame {
  seq: number;
  input: CarInput;
  after: CarSimState;
}

/** Position error (m) above which we rewind to server state and replay. */
const REWIND_POS_EPSILON = 0.05;
const REWIND_YAW_EPSILON = 0.01;
const MAX_HISTORY = 120; // 4s at 30Hz

export class PredictionBuffer {
  state: CarSimState;
  private history: PredictedFrame[] = [];
  private seq = 0;

  constructor(initial: CarSimState, private readonly track: Track) {
    this.state = cloneCarState(initial);
  }

  /** Advance one local tick; returns the seq to stamp on the outgoing frame. */
  step(input: CarInput): number {
    this.seq += 1;
    stepCar(this.state, input);
    collideWithWalls(this.track, this.state);
    this.history.push({ seq: this.seq, input, after: cloneCarState(this.state) });
    if (this.history.length > MAX_HISTORY) this.history.shift();
    return this.seq;
  }

  /**
   * Apply an authoritative snapshot. If our prediction at the acked seq
   * diverged, rewind to the server state and replay unacked inputs.
   * Returns true when a rewind happened (useful for debugging/telemetry).
   */
  reconcile(server: CarSimState, lastAckSeq: number): boolean {
    const ackedIdx = this.history.findIndex((f) => f.seq === lastAckSeq);
    const acked = ackedIdx >= 0 ? this.history[ackedIdx]! : null;
    // Drop everything the server has consumed.
    this.history = this.history.filter((f) => f.seq > lastAckSeq);

    if (acked) {
      const dx = acked.after.x - server.x;
      const dz = acked.after.z - server.z;
      const yawErr = Math.abs(angleDelta(acked.after.yaw, server.yaw));
      if (Math.hypot(dx, dz) <= REWIND_POS_EPSILON && yawErr <= REWIND_YAW_EPSILON) {
        return false; // prediction held
      }
    }

    // Rewind: adopt server truth, replay pending inputs on top.
    this.state = cloneCarState(server);
    for (const frame of this.history) {
      stepCar(this.state, frame.input);
      collideWithWalls(this.track, this.state);
      frame.after = cloneCarState(this.state);
    }
    return true;
  }

  get pendingFrames(): number {
    return this.history.length;
  }
}

// ── Remote-car interpolation ───────────────────────────────────────────────

export interface PoseSnapshot {
  t: number; // local receive time, ms
  x: number;
  z: number;
  yaw: number;
}

export class SnapshotInterpolator {
  private buffer: PoseSnapshot[] = [];

  push(snap: PoseSnapshot): void {
    this.buffer.push(snap);
    // Keep ~1s of history.
    while (this.buffer.length > 2 && this.buffer[0]!.t < snap.t - 1000) this.buffer.shift();
  }

  /** Sample the pose at `renderTime` (caller subtracts INTERP_DELAY_MS). */
  sample(renderTime: number): { x: number; z: number; yaw: number } | null {
    const buf = this.buffer;
    if (buf.length === 0) return null;
    if (buf.length === 1 || renderTime <= buf[0]!.t) return buf[0]!;

    for (let i = 0; i < buf.length - 1; i++) {
      const a = buf[i]!;
      const b = buf[i + 1]!;
      if (renderTime >= a.t && renderTime <= b.t) {
        const t = (renderTime - a.t) / Math.max(b.t - a.t, 1);
        return {
          x: a.x + (b.x - a.x) * t,
          z: a.z + (b.z - a.z) * t,
          yaw: a.yaw + angleDelta(b.yaw, a.yaw) * t,
        };
      }
    }
    return buf[buf.length - 1]!; // ahead of buffer: hold last known pose
  }
}

/** Shortest signed angle from `from` to `to`. */
export function angleDelta(to: number, from: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
