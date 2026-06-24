import { describe, expect, it } from "vitest";
import { BOT_PROFILES, botInput } from "./botDriver.js";
import { createCarState } from "./carSim.js";
import { NEUTRAL_HANDLING } from "../catalog.js";
import { stepCarResolved } from "./resolvedSim.js";
import { SIM_TICK_RATE } from "../physics.js";
import {
  buildTrack,
  collideWithWalls,
  createProgress,
  poseAtS,
  trackQuery,
  updateProgress,
} from "./track.js";
import { TRACKS } from "./tracks.js";

const MAX_SIM_SECONDS = 240; // a bot that can't lap in 4 minutes is stuck

describe("botDriver", () => {
  for (const [trackId, def] of Object.entries(TRACKS)) {
    it(`fastest bot completes a lap of ${trackId}`, () => {
      const track = buildTrack(def);
      const start = poseAtS(track, track.totalLength - 6);
      const sim = createCarState(start.x, start.z, start.yaw);
      const progress = createProgress(trackQuery(track, sim.x, sim.z).s);
      const profile = BOT_PROFILES[0]!;

      let lapped = false;
      for (let tick = 0; tick < MAX_SIM_SECONDS * SIM_TICK_RATE; tick++) {
        stepCarResolved(sim, botInput(track, sim, profile, tick), NEUTRAL_HANDLING);
        collideWithWalls(track, sim);
        updateProgress(track, progress, trackQuery(track, sim.x, sim.z).s, (tick * 1000) / SIM_TICK_RATE);
        if (progress.lap >= 1 || progress.finished) {
          lapped = true;
          break;
        }
      }
      expect(lapped).toBe(true);
    });
  }

  it("is deterministic — identical runs produce identical states", () => {
    const track = buildTrack(TRACKS["neon-row-circuit"]!);
    const run = () => {
      const start = poseAtS(track, track.totalLength - 6);
      const sim = createCarState(start.x, start.z, start.yaw);
      for (let tick = 0; tick < 900; tick++) {
        stepCarResolved(sim, botInput(track, sim, BOT_PROFILES[1]!, tick), NEUTRAL_HANDLING);
        collideWithWalls(track, sim);
      }
      return sim;
    };
    expect(run()).toStrictEqual(run());
  });
});
