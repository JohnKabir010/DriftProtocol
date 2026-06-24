"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";
import { SIM_DT, Track, carSpeed } from "@drift/shared";
import { OnlineSession } from "@/game/onlineSession";
import { useInput } from "@/game/useInput";
import { useRaceStore } from "@/stores/raceStore";
import { useSessionStore } from "@/stores/sessionStore";
import { api } from "@/lib/api";
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
 * the predicted local car and interpolated remote cars.
 */
export function OnlineRace({ track, difficulty }: { track: Track; difficulty?: "easy" | "medium" | "hard" }) {
  const [session, setSession] = useState<OnlineSession | null>(null);
  const [remoteIds, setRemoteIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const preRaceCreditsRef = useRef<number>(0);
  const rewardsApplied = useRef(false);
  const phase = useRaceStore((s) => s.phase);

  useEffect(() => {
    let active = true;
    let connected: OnlineSession | null = null;
    rewardsApplied.current = false;
    preRaceCreditsRef.current = Number(useSessionStore.getState().profile?.credits ?? 0);
    setError(null);
    useRaceStore.getState().reset();
    useRaceStore.getState().patch({ trackName: track.def.name });

    OnlineSession.connect(track, difficulty ? { difficulty } : undefined)
      .then((s) => {
        if (!active) return s.leave();
        connected = s;
        s.onRemotesChanged = setRemoteIds;
        setSession(s);
        s.ready();
      })
      .catch((err: unknown) => {
        if (!active) return;
        const msg = err instanceof Error ? err.message : "Connection failed";
        console.error("[online] connect failed — is the api+realtime stack up?", err);
        setError(msg);
      });

    return () => {
      active = false;
      connected?.leave();
    };
  }, [track, difficulty]);

  // After the race finishes, fetch updated profile to compute credit reward delta.
  useEffect(() => {
    if (phase !== "FINISHED" || rewardsApplied.current) return;
    rewardsApplied.current = true;

    const applyRewards = async () => {
      // Give the API 1.5 s to process the result report before fetching.
      await new Promise<void>((r) => setTimeout(r, 1500));
      try {
        const updated = await api.players.me();
        useSessionStore.getState().setProfile(updated);
        const earned = Number(updated.credits) - preRaceCreditsRef.current;
        if (earned > 0) {
          const results = useRaceStore.getState().results;
          if (results) {
            useRaceStore.getState().patch({
              results: results.map((r) => (r.isLocal ? { ...r, creditsEarned: earned } : r)),
            });
          }
        }
      } catch {
        // Non-critical — results still show without reward numbers
      }
    };
    void applyRewards();
  }, [phase]);

  if (error) {
    return (
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[2, 1, 0.1]} />
        <meshBasicMaterial color="#ff2e97" />
      </mesh>
    );
  }

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
