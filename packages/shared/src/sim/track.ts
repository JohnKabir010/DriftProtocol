/**
 * Track model: a Catmull-Rom centerline sampled into segments, with a track
 * width, ordered checkpoints, and analytic wall collision. Both the server
 * (authoritative) and the client (prediction + rendering) build the same
 * track from the same definition — geometry is data, never duplicated.
 */

import { CarSimState, dropDrift } from "./carSim.js";

/** Visual environment family. Pure rendering metadata — never affects the sim. */
export type TrackTheme =
  | "neon-city"
  | "rain-city"
  | "mountain"
  | "forest"
  | "hills"
  | "canyon";

export interface TrackDef {
  id: string;
  name: string;
  /** Closed-loop centerline control points, [x, z]. */
  controlPoints: ReadonlyArray<readonly [number, number]>;
  width: number;
  laps: number;
  checkpointCount: number;
  samplesPerSegment: number;
  /** Environment family used by the client renderer. Defaults to "neon-city". */
  theme?: TrackTheme;
}

export interface TrackSample {
  x: number;
  z: number;
  /** Cumulative arc length at this sample. */
  s: number;
  /** Unit direction toward the next sample. */
  dirX: number;
  dirZ: number;
}

export interface Track {
  def: TrackDef;
  samples: TrackSample[];
  totalLength: number;
  /** Checkpoint arc positions, ascending; the last one is the lap line (=totalLength). */
  checkpoints: number[];
  halfWidth: number;
}

export interface TrackQuery {
  /** Arc-length position of the closest centerline point. */
  s: number;
  /** Signed lateral offset; positive = left of travel direction. */
  lateral: number;
  dirX: number;
  dirZ: number;
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t3)
  );
}

export function buildTrack(def: TrackDef): Track {
  const cps = def.controlPoints;
  const n = cps.length;
  const samples: TrackSample[] = [];

  for (let i = 0; i < n; i++) {
    const p0 = cps[(i - 1 + n) % n]!;
    const p1 = cps[i]!;
    const p2 = cps[(i + 1) % n]!;
    const p3 = cps[(i + 2) % n]!;
    for (let j = 0; j < def.samplesPerSegment; j++) {
      const t = j / def.samplesPerSegment;
      samples.push({
        x: catmullRom(p0[0], p1[0], p2[0], p3[0], t),
        z: catmullRom(p0[1], p1[1], p2[1], p3[1], t),
        s: 0,
        dirX: 0,
        dirZ: 0,
      });
    }
  }

  // Arc length + directions (loop closes back to sample 0).
  let s = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = samples[i]!;
    const b = samples[(i + 1) % samples.length]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1e-6;
    a.s = s;
    a.dirX = dx / len;
    a.dirZ = dz / len;
    s += len;
  }
  const totalLength = s;

  const checkpoints: number[] = [];
  for (let k = 1; k <= def.checkpointCount; k++) {
    checkpoints.push((totalLength * k) / def.checkpointCount);
  }

  return { def, samples, totalLength, checkpoints, halfWidth: def.width / 2 };
}

/** Closest-point query against the sampled centerline (full scan; ~150 segments). */
export function trackQuery(track: Track, x: number, z: number): TrackQuery {
  const samples = track.samples;
  let best = Infinity;
  let bestS = 0;
  let bestLat = 0;
  let bestDirX = 0;
  let bestDirZ = 1;

  for (let i = 0; i < samples.length; i++) {
    const a = samples[i]!;
    const b = samples[(i + 1) % samples.length]!;
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const segLen2 = abx * abx + abz * abz || 1e-9;
    let t = ((x - a.x) * abx + (z - a.z) * abz) / segLen2;
    t = Math.min(Math.max(t, 0), 1);
    const px = a.x + abx * t;
    const pz = a.z + abz * t;
    const dx = x - px;
    const dz = z - pz;
    const d2 = dx * dx + dz * dz;
    if (d2 < best) {
      best = d2;
      bestS = a.s + Math.sqrt(segLen2) * t;
      // Signed lateral via 2D cross product of direction × offset.
      bestLat = a.dirX * dz - a.dirZ * dx;
      bestDirX = a.dirX;
      bestDirZ = a.dirZ;
    }
  }
  return { s: bestS % track.totalLength, lateral: bestLat, dirX: bestDirX, dirZ: bestDirZ };
}

/** Pose on the centerline at arc position `s` (start grids, checkpoint gates). */
export function poseAtS(track: Track, s: number): { x: number; z: number; yaw: number } {
  const wrapped = ((s % track.totalLength) + track.totalLength) % track.totalLength;
  const samples = track.samples;
  let i = samples.length - 1;
  for (let k = 0; k < samples.length; k++) {
    if (samples[k]!.s > wrapped) {
      i = (k - 1 + samples.length) % samples.length;
      break;
    }
  }
  const a = samples[i]!;
  const along = wrapped - a.s;
  return {
    x: a.x + a.dirX * along,
    z: a.z + a.dirZ * along,
    yaw: Math.atan2(a.dirX, a.dirZ),
  };
}

const WALL_MARGIN = 1.0; // car half-width allowance

/**
 * Clamp the car inside the track walls. Kills the outward velocity component
 * and drops the live drift chain on impact. Returns true on wall contact.
 */
export function collideWithWalls(track: Track, car: CarSimState): boolean {
  const q = trackQuery(track, car.x, car.z);
  const limit = track.halfWidth - WALL_MARGIN;
  if (Math.abs(q.lateral) <= limit) return false;

  // Outward normal (left of travel when lateral > 0).
  const sign = Math.sign(q.lateral);
  const nx = -q.dirZ * sign;
  const nz = q.dirX * sign;
  const overshoot = Math.abs(q.lateral) - limit;
  car.x -= nx * overshoot;
  car.z -= nz * overshoot;

  const vOut = car.vx * nx + car.vz * nz;
  if (vOut > 0) {
    car.vx -= nx * vOut * 1.4; // slight bounce-back
    car.vz -= nz * vOut * 1.4;
  }
  dropDrift(car);
  return true;
}

// ── Race progress ──────────────────────────────────────────────────────────

export interface RaceProgress {
  lap: number; // 0-based completed-lap counter
  cpIdx: number; // next checkpoint index to cross
  /** Continuous progress in meters since the start (monotonic-ish). */
  p: number;
  lastS: number;
  finished: boolean;
  finishTimeMs: number | null;
}

export function createProgress(startS: number): RaceProgress {
  return { lap: 0, cpIdx: 0, p: 0, lastS: startS, finished: false, finishTimeMs: null };
}

const MAX_DS_PER_TICK = 15; // meters; larger jumps are folds/teleports — ignored

/**
 * Advance progress from a new arc position. Checkpoints must be crossed in
 * order (cutting across a fold can't skip them), and per-tick progress is
 * clamped so teleports never count.
 */
export function updateProgress(
  track: Track,
  prog: RaceProgress,
  s: number,
  raceTimeMs: number,
): void {
  if (prog.finished) return;
  const L = track.totalLength;
  let ds = s - prog.lastS;
  if (ds < -L / 2) ds += L;
  if (ds > L / 2) ds -= L;
  ds = Math.min(Math.max(ds, -MAX_DS_PER_TICK), MAX_DS_PER_TICK);
  prog.p += ds;
  prog.lastS = s;

  let target = prog.lap * L + track.checkpoints[prog.cpIdx]!;
  while (prog.p >= target) {
    prog.cpIdx += 1;
    if (prog.cpIdx >= track.checkpoints.length) {
      prog.cpIdx = 0;
      prog.lap += 1;
      if (prog.lap >= track.def.laps) {
        prog.finished = true;
        prog.finishTimeMs = raceTimeMs;
        return;
      }
    }
    target = prog.lap * L + track.checkpoints[prog.cpIdx]!;
  }
}

/** Standings: finishers by time, then everyone else by distance covered. */
export function sortStandings<T extends { progress: RaceProgress }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    if (a.progress.finished && b.progress.finished) {
      return (a.progress.finishTimeMs ?? 0) - (b.progress.finishTimeMs ?? 0);
    }
    if (a.progress.finished) return -1;
    if (b.progress.finished) return 1;
    return b.progress.p - a.progress.p;
  });
}
