"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Vector3 } from "three";
import {
  SIM_DT,
  Track,
  type HandlingProfile,
  bankDrift,
  carSpeed,
  collideWithWalls,
  createCarState,
  createProgress,
  poseAtS,
  resolveHandling,
  stepCarResolved,
  trackQuery,
  updateProgress,
} from "@drift/shared";
import { useInput } from "@/game/useInput";
import { useRaceStore } from "@/stores/raceStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useEngineAudio } from "@/hooks/useEngineAudio";
import { CarBody } from "./CarBody";
import { DriftSmoke } from "./vfx/DriftSmoke";
import { Skidmarks } from "./vfx/Skidmarks";

const COUNTDOWN_MS = 3000;
const TELEMETRY_INTERVAL = 0.1;

function useHandling(): HandlingProfile {
  const profile = useSessionStore((s) => s.profile);
  // garage selection not yet persisted; fall back to a sensible default
  const modelKey = (profile as any)?.selectedCarModelKey ?? "c-neon-runner";
  return resolveHandling(modelKey, {});
}

export function PlayerCar({ track }: { track: Track }) {
  const group = useRef<Group>(null);
  const input = useInput();
  const handling = useHandling();
  const { update: updateAudio } = useEngineAudio();

  // Expose car position/yaw as refs so VFX don't cause re-renders.
  const carPos = useRef(new Vector3());
  const carYaw = useRef(0);
  const isDrifting = useRef(false);

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

  useEffect(() => {
    const store = useRaceStore.getState();
    store.reset();
    store.patch({
      phase: "COUNTDOWN",
      countdownEndsAt: Date.now() + COUNTDOWN_MS,
      totalLaps: track.def.laps,
      trackName: track.def.name,
    });
    const timer = setTimeout(() => useRaceStore.getState().patch({ phase: "RACING" }), COUNTDOWN_MS);
    return () => clearTimeout(timer);
  }, [track]);

  useFrame((_, dt) => {
    const store = useRaceStore.getState();
    const w = world;

    if (store.phase === "RACING" && !w.finished) {
      w.accumulator += Math.min(dt, 0.1);
      while (w.accumulator >= SIM_DT) {
        w.accumulator -= SIM_DT;
        stepCarResolved(w.sim, input.current, handling);
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

    const g = group.current;
    if (g) {
      g.position.set(w.sim.x, 0, w.sim.z);
      g.rotation.y = w.sim.yaw;
      g.rotation.z = -input.current.steer * Math.min(carSpeed(w.sim) / 40, 1) * 0.1;
    }

    // Update refs for VFX (no React re-render)
    carPos.current.set(w.sim.x, 0, w.sim.z);
    carYaw.current = w.sim.yaw;
    isDrifting.current = w.sim.drifting;

    // Engine audio (lazy init — AudioContext requires user gesture first)
    const speed = carSpeed(w.sim) * 3.6;
    updateAudio(
      speed,
      input.current.throttle,
      w.sim.drifting,
      w.sim.nitroMs > 0,
      store.phase === "RACING" && !w.finished,
    );

    w.telemetryTimer += dt;
    if (w.telemetryTimer >= TELEMETRY_INTERVAL && !w.finished) {
      w.telemetryTimer = 0;
      store.patch({
        speedKmh: speed,
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

  return (
    <>
      <CarBody ref={group} name="player-car" />
      <DriftSmoke carPosition={carPos.current} carYaw={carYaw.current} active={isDrifting.current} />
      <Skidmarks carPosition={carPos.current} carYaw={carYaw.current} active={isDrifting.current} />
    </>
  );
}
