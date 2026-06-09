"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";
import {
  SIM_DT,
  Track,
  bankDrift,
  carSpeed,
  collideWithWalls,
  createCarState,
  createProgress,
  poseAtS,
  stepCar,
  trackQuery,
  updateProgress,
} from "@drift/shared";
import { useInput } from "@/game/useInput";
import { useRaceStore } from "@/stores/raceStore";
import { CarBody } from "./CarBody";

const COUNTDOWN_MS = 3000;
const TELEMETRY_INTERVAL = 0.1; // seconds between HUD store writes

/**
 * Local (offline) race controller: runs the shared deterministic sim in a
 * fixed-step accumulator, enforces walls/checkpoints/laps exactly like the
 * server does, and drives the HUD. The online path replaces only the input
 * source and adds reconciliation — same sim, same track, same renderer.
 */
export function PlayerCar({ track }: { track: Track }) {
  const group = useRef<Group>(null);
  const input = useInput();

  const world = useMemo(() => {
    const startPose = poseAtS(track, track.totalLength - 6);
    const sim = createCarState(startPose.x, startPose.z, startPose.yaw);
    return {
      sim,
      progress: createProgress(trackQuery(track, sim.x, sim.z).s),
      accumulator: 0,
      raceTimeMs: 0,
      telemetryTimer: 0,
      finished: false,
    };
  }, [track]);

  // Race start sequence: brief countdown, then green light.
  useEffect(() => {
    const store = useRaceStore.getState();
    store.reset();
    store.patch({
      phase: "COUNTDOWN",
      countdownEndsAt: Date.now() + COUNTDOWN_MS,
      totalLaps: track.def.laps,
    });
    const timer = setTimeout(() => useRaceStore.getState().patch({ phase: "RACING" }), COUNTDOWN_MS);
    return () => clearTimeout(timer);
  }, [track]);

  useFrame((_, dt) => {
    const store = useRaceStore.getState();
    const w = world;

    if (store.phase === "RACING" && !w.finished) {
      w.accumulator += Math.min(dt, 0.1); // clamp tab-back spikes
      while (w.accumulator >= SIM_DT) {
        w.accumulator -= SIM_DT;
        stepCar(w.sim, input.current);
        collideWithWalls(track, w.sim);
        w.raceTimeMs += SIM_DT * 1000;
        const q = trackQuery(track, w.sim.x, w.sim.z);
        updateProgress(track, w.progress, q.s, w.raceTimeMs);
        if (w.progress.finished) {
          w.finished = true;
          bankDrift(w.sim);
          store.patch({
            phase: "FINISHED",
            driftScore: Math.round(w.sim.driftScore),
            results: [
              {
                handle: "you",
                position: 1,
                finishTimeMs: w.progress.finishTimeMs,
                driftScore: Math.round(w.sim.driftScore),
                isLocal: true,
              },
            ],
          });
        }
      }
    }

    // Apply sim → visuals every render frame.
    const g = group.current;
    if (g) {
      g.position.set(w.sim.x, 0, w.sim.z);
      g.rotation.y = w.sim.yaw;
      g.rotation.z = -input.current.steer * Math.min(carSpeed(w.sim) / 40, 1) * 0.1; // body roll
    }

    // Throttled HUD telemetry (10Hz — don't re-render React at 60fps).
    w.telemetryTimer += dt;
    if (w.telemetryTimer >= TELEMETRY_INTERVAL && !w.finished) {
      w.telemetryTimer = 0;
      store.patch({
        speedKmh: carSpeed(w.sim) * 3.6,
        boosting: w.sim.nitroMs > 0,
        nitroBottles: w.sim.bottles,
        nitroCharge: w.sim.nitroCharge,
        driftChain: Math.round(w.sim.driftChain),
        driftScore: Math.round(w.sim.driftScore),
        lap: Math.min(w.progress.lap + 1, track.def.laps),
        raceTimeMs: Math.round(w.raceTimeMs),
      });
    }
  });

  return <CarBody ref={group} name="player-car" />;
}
