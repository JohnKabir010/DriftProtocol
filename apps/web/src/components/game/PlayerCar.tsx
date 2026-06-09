"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";
import { BASE_CAR } from "@drift/shared";
import { useInput } from "@/game/useInput";
import { useRaceStore } from "@/stores/raceStore";

/**
 * Local player car. Runs the same kinematic model as the server's Phase-1
 * RaceRoom.integrateCar so prediction/reconciliation stays trivial. The
 * placeholder box geometry swaps for a GLTF model without touching logic.
 */
export function PlayerCar() {
  const group = useRef<Group>(null);
  const input = useInput();
  const sim = useRef({ speed: 0, yaw: 0 });

  useFrame((_, dt) => {
    const clamped = Math.min(dt, 1 / 20); // avoid tunneling on tab-back
    const { throttle, brake, steer } = input.current;
    const s = sim.current;

    const accel = (throttle * BASE_CAR.engineForce - brake * BASE_CAR.brakeForce) / BASE_CAR.mass;
    s.speed = Math.min(Math.max(s.speed + accel * clamped - s.speed * 0.3 * clamped, 0), BASE_CAR.maxSpeed);

    const steerAngle =
      BASE_CAR.steerAngleLowSpeed +
      (BASE_CAR.steerAngleHighSpeed - BASE_CAR.steerAngleLowSpeed) * (s.speed / BASE_CAR.maxSpeed);
    if (s.speed > 1) s.yaw += steer * steerAngle * clamped * 2.2;

    const g = group.current;
    if (!g) return;
    g.rotation.y = s.yaw;
    g.position.x += Math.sin(s.yaw) * s.speed * clamped;
    g.position.z += Math.cos(s.yaw) * s.speed * clamped;
    // Visual-only body roll into the turn.
    g.rotation.z = -steer * Math.min(s.speed / BASE_CAR.maxSpeed, 1) * 0.12;

    useRaceStore.getState().setTelemetry({ speedKmh: s.speed * 3.6 });
  });

  return (
    <group ref={group} name="player-car">
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[1.9, 0.7, 4.2]} />
        <meshStandardMaterial color="#101622" roughness={0.2} metalness={0.9} />
      </mesh>
      {/* Neon underglow + tail lights */}
      <pointLight position={[0, 0.15, 0]} color="#00f0ff" intensity={6} distance={5} />
      <mesh position={[0, 0.55, -2.11]}>
        <boxGeometry args={[1.6, 0.12, 0.05]} />
        <meshStandardMaterial emissive="#ff2e97" emissiveIntensity={4} color="#000" />
      </mesh>
    </group>
  );
}
