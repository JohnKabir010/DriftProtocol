"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";
import { SIM_DT, Track, carSpeed } from "@drift/shared";
import { OnlineSession } from "@/game/onlineSession";
import { useInput } from "@/game/useInput";
import { useRaceStore } from "@/stores/raceStore";
import { CarBody } from "./CarBody";

/** Local predicted car: steps the shared sim each fixed tick, ships inputs. */
function OnlineLocalCar({ session }: { session: OnlineSession }) {
  const group = useRef<Group>(null);
  const input = useInput();
  const acc = useRef({ t: 0, telemetry: 0 });

  useFrame((_, dt) => {
    const store = useRaceStore.getState();
    if (store.phase === "RACING") {
      acc.current.t += Math.min(dt, 0.1);
      while (acc.current.t >= SIM_DT) {
        acc.current.t -= SIM_DT;
        session.tick({ ...input.current });
      }
    }

    const s = session.prediction.state;
    const g = group.current;
    if (g) {
      g.position.set(s.x, 0, s.z);
      g.rotation.y = s.yaw;
      g.rotation.z = -input.current.steer * Math.min(carSpeed(s) / 40, 1) * 0.1;
    }

    acc.current.telemetry += dt;
    if (acc.current.telemetry >= 0.1) {
      acc.current.telemetry = 0;
      store.patch({
        speedKmh: carSpeed(s) * 3.6,
        boosting: s.nitroMs > 0,
        nitroBottles: s.bottles,
        nitroCharge: s.nitroCharge,
        driftChain: Math.round(s.driftChain),
        driftScore: Math.round(s.driftScore),
      });
    }
  });

  return <CarBody ref={group} name="player-car" />;
}

/** One interpolated remote car. */
function RemoteCar({ session, id }: { session: OnlineSession; id: string }) {
  const group = useRef<Group>(null);
  useFrame(() => {
    const pose = session.remotes.get(id)?.sample(session.remoteRenderTime());
    const g = group.current;
    if (pose && g) {
      g.position.set(pose.x, 0, pose.z);
      g.rotation.y = pose.yaw;
    }
  });
  return <CarBody ref={group} accent="#ccff00" underglow="#ff2e97" />;
}

/**
 * Online race entry point: connects (guest auth → ticket → room), renders
 * the predicted local car and interpolated remote cars. Experimental in
 * Phase 2 — the local mode is the primary play path until matchmaking ships.
 */
export function OnlineRace({ track }: { track: Track }) {
  const [session, setSession] = useState<OnlineSession | null>(null);
  const [remoteIds, setRemoteIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    let connected: OnlineSession | null = null;
    useRaceStore.getState().reset();

    OnlineSession.connect(track)
      .then((s) => {
        if (!active) return s.leave();
        connected = s;
        s.onRemotesChanged = setRemoteIds;
        setSession(s);
        s.ready();
      })
      .catch((err) => {
        console.error("[online] connect failed — is the api+realtime stack up?", err);
      });

    return () => {
      active = false;
      connected?.leave();
    };
  }, [track]);

  if (!session) return null;
  return (
    <>
      <OnlineLocalCar session={session} />
      {remoteIds.map((id) => (
        <RemoteCar key={id} session={session} id={id} />
      ))}
    </>
  );
}
