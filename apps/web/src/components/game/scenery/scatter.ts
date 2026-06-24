import type { Track } from "@drift/shared";
import { poseAtS } from "@drift/shared";

/**
 * Deterministic scenery placement. Everything is seeded from the track id, so
 * a map always looks the same on every machine and every mount — no pop-in
 * reshuffles, and the layout is reproducible in bug reports.
 */

export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — tiny, fast, good-enough PRNG for prop placement. */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ScatterPoint {
  x: number;
  z: number;
  /** Per-point deterministic random in [0,1) — drives scale/rotation jitter. */
  r: number;
}

export function trackBounds(track: Track) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const s of track.samples) {
    minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x);
    minZ = Math.min(minZ, s.z); maxZ = Math.max(maxZ, s.z);
  }
  return { minX, maxX, minZ, maxZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 };
}

/** Squared distance from (x,z) to the nearest centerline sample. */
function nearestSampleDist2(track: Track, x: number, z: number): number {
  let best = Infinity;
  for (const s of track.samples) {
    const dx = x - s.x;
    const dz = z - s.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < best) best = d2;
  }
  return best;
}

/**
 * Rejection-sample points in the track's (expanded) bounding box, keeping a
 * clearance band around the racing line so nothing ever sits on the road.
 */
export function scatterPoints(
  track: Track,
  rng: () => number,
  opts: { count: number; clearance: number; margin: number; maxDistance?: number },
): ScatterPoint[] {
  const b = trackBounds(track);
  const minClear2 = (track.halfWidth + opts.clearance) ** 2;
  const maxDist2 = opts.maxDistance ? opts.maxDistance ** 2 : Infinity;
  const points: ScatterPoint[] = [];

  for (let tries = 0; points.length < opts.count && tries < opts.count * 12; tries++) {
    const x = b.minX - opts.margin + rng() * (b.maxX - b.minX + opts.margin * 2);
    const z = b.minZ - opts.margin + rng() * (b.maxZ - b.minZ + opts.margin * 2);
    const d2 = nearestSampleDist2(track, x, z);
    if (d2 < minClear2 || d2 > maxDist2) continue;
    points.push({ x, z, r: rng() });
  }
  return points;
}

/**
 * Points flanking the racing line at regular arc intervals — canyon walls,
 * guard scenery, anything that should follow the road's shape.
 */
export function corridorPoints(
  track: Track,
  rng: () => number,
  opts: { spacing: number; minOffset: number; maxOffset: number },
): Array<ScatterPoint & { yaw: number; side: 1 | -1 }> {
  const out: Array<ScatterPoint & { yaw: number; side: 1 | -1 }> = [];
  for (let s = 0; s < track.totalLength; s += opts.spacing) {
    for (const side of [1, -1] as const) {
      const pose = poseAtS(track, s + rng() * opts.spacing * 0.4);
      const off = (opts.minOffset + rng() * (opts.maxOffset - opts.minOffset)) * side;
      // Left normal of travel: (-dirZ, dirX) → from yaw: (cos yaw, -sin yaw).
      out.push({
        x: pose.x + Math.cos(pose.yaw) * off,
        z: pose.z - Math.sin(pose.yaw) * off,
        r: rng(),
        yaw: pose.yaw,
        side,
      });
    }
  }
  return out;
}

/** Ring of positions around the track's center — distant backdrops. */
export function ringPoints(
  track: Track,
  rng: () => number,
  opts: { count: number; minRadius: number; maxRadius: number },
): ScatterPoint[] {
  const b = trackBounds(track);
  return Array.from({ length: opts.count }, (_, i) => {
    const angle = (i / opts.count) * Math.PI * 2 + (rng() - 0.5) * 0.4;
    const radius = opts.minRadius + rng() * (opts.maxRadius - opts.minRadius);
    return { x: b.cx + Math.cos(angle) * radius, z: b.cz + Math.sin(angle) * radius, r: rng() };
  });
}
