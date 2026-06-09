import type { TrackDef } from "./track.js";

/**
 * Track catalog. Tracks are data: the same definition drives server
 * simulation, client prediction, and client rendering.
 */

/** Neon Row circuit — the Phase-2 proving track: two long straights for
 * nitro, a hairpin and a chicane for drift chains. */
export const NEON_ROW_CIRCUIT: TrackDef = {
  id: "neon-row-circuit",
  name: "Neon Row Circuit",
  controlPoints: [
    [0, 0],
    [0, 90],
    [-30, 150],
    [-15, 215],
    [45, 235],
    [100, 200],
    [120, 130],
    [85, 75],
    [110, 15],
    [65, -35],
    [20, -25],
  ],
  width: 14,
  laps: 2,
  checkpointCount: 6,
  samplesPerSegment: 12,
};

export const TRACKS: Record<string, TrackDef> = {
  [NEON_ROW_CIRCUIT.id]: NEON_ROW_CIRCUIT,
};
