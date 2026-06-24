import type { TrackDef } from "./track.js";

/**
 * Track catalog. Tracks are data: the same definition drives server
 * simulation, client prediction, and client rendering. Control points are
 * closed-loop Catmull-Rom centerlines; widths/laps tune the difficulty.
 *
 * IDs here must stay in sync with TRACK_DISTRICT in the API districts
 * service — districts award influence keyed on these IDs.
 */

/** Neon Row circuit — the Phase-2 proving track: two long straights for
 * nitro, a hairpin and a chicane for drift chains. */
export const NEON_ROW_CIRCUIT: TrackDef = {
  id: "neon-row-circuit",
  name: "Neon Row Circuit",
  theme: "neon-city",
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

/** Docklands Sprint — rain-slick harbor straights under sodium lights.
 * Wide and fast: a nitro-management track with two heavy braking zones. */
export const DOCKLANDS_SPRINT: TrackDef = {
  id: "docklands-sprint",
  name: "Docklands Sprint",
  theme: "rain-city",
  controlPoints: [
    [0, 0],
    [10, 110],
    [0, 200],
    [60, 250],
    [140, 230],
    [170, 150],
    [150, 60],
    [180, -20],
    [120, -70],
    [40, -50],
  ],
  width: 16,
  laps: 2,
  checkpointCount: 6,
  samplesPerSegment: 12,
};

/** Docklands Circuit — tighter sister loop threading the container yards. */
export const DOCKLANDS_CIRCUIT: TrackDef = {
  id: "docklands-circuit",
  name: "Docklands Circuit",
  theme: "rain-city",
  controlPoints: [
    [0, 0],
    [-15, 80],
    [25, 140],
    [-10, 200],
    [60, 235],
    [115, 185],
    [90, 115],
    [130, 55],
    [95, -10],
    [40, -30],
  ],
  width: 13,
  laps: 3,
  checkpointCount: 7,
  samplesPerSegment: 12,
};

/** Stacks Drift Bowl — a hillside amphitheater of linked sweepers built
 * for chain drifting. Almost no straights; constant slip-angle work. */
export const STACKS_DRIFT_BOWL: TrackDef = {
  id: "stacks-drift-bowl",
  name: "Stacks Drift Bowl",
  theme: "hills",
  controlPoints: [
    [0, 0],
    [-50, 40],
    [-70, 110],
    [-30, 170],
    [40, 185],
    [95, 140],
    [110, 70],
    [70, 20],
    [95, -45],
    [35, -70],
    [-20, -45],
  ],
  width: 15,
  laps: 2,
  checkpointCount: 8,
  samplesPerSegment: 14,
};

/** Stacks Circuit — the residential towers loop above the bowl. */
export const STACKS_CIRCUIT: TrackDef = {
  id: "stacks-circuit",
  name: "Stacks Circuit",
  theme: "hills",
  controlPoints: [
    [0, 0],
    [5, 95],
    [-40, 145],
    [-20, 220],
    [55, 245],
    [120, 205],
    [135, 120],
    [100, 50],
    [125, -25],
    [55, -55],
  ],
  width: 14,
  laps: 2,
  checkpointCount: 6,
  samplesPerSegment: 12,
};

/** Skyline Loop — a mountain pass: long climbing straight, switchback
 * descent, and a ridge-line esses section. */
export const SKYLINE_LOOP: TrackDef = {
  id: "skyline-loop",
  name: "Skyline Loop",
  theme: "mountain",
  controlPoints: [
    [0, 0],
    [-10, 130],
    [-60, 180],
    [-40, 250],
    [30, 290],
    [110, 260],
    [90, 190],
    [150, 150],
    [170, 70],
    [120, 10],
    [140, -60],
    [60, -80],
  ],
  width: 13,
  laps: 2,
  checkpointCount: 8,
  samplesPerSegment: 14,
};

/** Evergreen Rally — a forest road: flowing medium-speed corners between
 * the trees with one flat-out river-side straight. */
export const EVERGREEN_RALLY: TrackDef = {
  id: "evergreen-rally",
  name: "Evergreen Rally",
  theme: "forest",
  controlPoints: [
    [0, 0],
    [40, 70],
    [10, 140],
    [60, 200],
    [0, 260],
    [-80, 240],
    [-110, 160],
    [-70, 90],
    [-100, 20],
    [-50, -40],
  ],
  width: 12,
  laps: 2,
  checkpointCount: 7,
  samplesPerSegment: 14,
};

/** Red Canyon Run — open desert canyon: huge sweeping radii, the fastest
 * average speed in the catalog. */
export const RED_CANYON_RUN: TrackDef = {
  id: "red-canyon-run",
  name: "Red Canyon Run",
  theme: "canyon",
  controlPoints: [
    [0, 0],
    [20, 140],
    [-40, 230],
    [40, 320],
    [160, 330],
    [240, 250],
    [220, 130],
    [260, 30],
    [180, -60],
    [60, -50],
  ],
  width: 18,
  laps: 2,
  checkpointCount: 6,
  samplesPerSegment: 12,
};

export const TRACKS: Record<string, TrackDef> = {
  [NEON_ROW_CIRCUIT.id]: NEON_ROW_CIRCUIT,
  [DOCKLANDS_SPRINT.id]: DOCKLANDS_SPRINT,
  [DOCKLANDS_CIRCUIT.id]: DOCKLANDS_CIRCUIT,
  [STACKS_DRIFT_BOWL.id]: STACKS_DRIFT_BOWL,
  [STACKS_CIRCUIT.id]: STACKS_CIRCUIT,
  [SKYLINE_LOOP.id]: SKYLINE_LOOP,
  [EVERGREEN_RALLY.id]: EVERGREEN_RALLY,
  [RED_CANYON_RUN.id]: RED_CANYON_RUN,
};

export const DEFAULT_TRACK_ID = NEON_ROW_CIRCUIT.id;
