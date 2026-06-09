import { describe, expect, it } from "vitest";
import { createCarState } from "./carSim.js";
import {
  buildTrack,
  collideWithWalls,
  createProgress,
  poseAtS,
  sortStandings,
  trackQuery,
  updateProgress,
} from "./track.js";
import { NEON_ROW_CIRCUIT } from "./tracks.js";

const track = buildTrack(NEON_ROW_CIRCUIT);

describe("track", () => {
  it("builds a closed loop with checkpoints ending at the lap line", () => {
    expect(track.totalLength).toBeGreaterThan(500);
    expect(track.checkpoints).toHaveLength(NEON_ROW_CIRCUIT.checkpointCount);
    expect(track.checkpoints[track.checkpoints.length - 1]).toBeCloseTo(track.totalLength, 6);
  });

  it("trackQuery returns near-zero lateral on the centerline", () => {
    const pose = poseAtS(track, track.totalLength * 0.37);
    const q = trackQuery(track, pose.x, pose.z);
    expect(Math.abs(q.lateral)).toBeLessThan(0.5);
  });

  it("collideWithWalls pushes an outside car back in and drops its chain", () => {
    const pose = poseAtS(track, 50);
    const q = trackQuery(track, pose.x, pose.z);
    // Place the car well outside the left wall.
    const car = createCarState(
      pose.x + -q.dirZ * (track.halfWidth + 5),
      pose.z + q.dirX * (track.halfWidth + 5),
      pose.yaw,
    );
    car.driftChain = 500;
    const hit = collideWithWalls(track, car);
    expect(hit).toBe(true);
    expect(car.driftChain).toBe(0);
    const after = trackQuery(track, car.x, car.z);
    expect(Math.abs(after.lateral)).toBeLessThanOrEqual(track.halfWidth);
  });

  it("progress crosses checkpoints in order and finishes after configured laps", () => {
    const prog = createProgress(0);
    const stepM = 5; // meters per tick, below the anti-teleport clamp
    let raceTime = 0;
    const totalDistance = track.totalLength * track.def.laps + 10;
    for (let d = stepM; d <= totalDistance; d += stepM) {
      raceTime += 33;
      updateProgress(track, prog, d % track.totalLength, raceTime);
      if (prog.finished) break;
    }
    expect(prog.finished).toBe(true);
    expect(prog.finishTimeMs).toBeGreaterThan(0);
  });

  it("teleports do not advance progress", () => {
    const prog = createProgress(0);
    updateProgress(track, prog, track.totalLength / 2, 1000); // huge jump
    expect(prog.p).toBeLessThanOrEqual(15);
  });

  it("sortStandings ranks finishers by time then runners by distance", () => {
    const finishedFast = { progress: { ...createProgress(0), finished: true, finishTimeMs: 60_000 } };
    const finishedSlow = { progress: { ...createProgress(0), finished: true, finishTimeMs: 70_000 } };
    const leadRunner = { progress: { ...createProgress(0), p: 900 } };
    const tailRunner = { progress: { ...createProgress(0), p: 400 } };
    const order = sortStandings([tailRunner, finishedSlow, leadRunner, finishedFast]);
    expect(order).toStrictEqual([finishedFast, finishedSlow, leadRunner, tailRunner]);
  });
});
