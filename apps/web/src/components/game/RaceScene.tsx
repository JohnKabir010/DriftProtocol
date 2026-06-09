"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Grid } from "@react-three/drei";
import { Bloom, ChromaticAberration, EffectComposer } from "@react-three/postprocessing";
import { Vector2 } from "three";
import { buildTrack, NEON_ROW_CIRCUIT } from "@drift/shared";
import { PlayerCar } from "./PlayerCar";
import { OnlineRace } from "./OnlineRace";
import { ChaseCamera } from "./ChaseCamera";
import { CityBlocks } from "./CityBlocks";
import { TrackMesh } from "./TrackMesh";

/**
 * Phase-2 scene: Neon Row circuit built from shared track data, drivable car
 * on the shared deterministic sim, chase camera with speed/nitro FOV kick,
 * and the neon post stack.
 */
export default function RaceScene({ online = false }: { online?: boolean }) {
  const track = useMemo(() => buildTrack(NEON_ROW_CIRCUIT), []);

  return (
    <Canvas
      className="absolute inset-0"
      dpr={[1, 1.75]}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      camera={{ fov: 60, position: [0, 4, -8] }}
    >
      <color attach="background" args={["#0A0E17"]} />
      <fog attach="fog" args={["#0A0E17", 60, 220]} />

      <ambientLight intensity={0.15} />
      <directionalLight position={[10, 20, 5]} intensity={0.3} color="#7df" />

      {/* Ground plane under the elevated circuit */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[50, -0.05, 100]} receiveShadow>
        <planeGeometry args={[700, 700]} />
        <meshStandardMaterial color="#0b0f1a" roughness={0.3} metalness={0.7} />
      </mesh>
      <Grid
        position={[50, 0, 100]}
        args={[700, 700]}
        cellSize={4}
        cellColor="#0d2a33"
        sectionSize={20}
        sectionColor="#123a44"
        fadeDistance={250}
        infiniteGrid
      />

      <TrackMesh track={track} />
      <CityBlocks />
      {online ? <OnlineRace track={track} /> : <PlayerCar track={track} />}
      <ChaseCamera />

      <Environment preset="night" />
      <EffectComposer>
        <Bloom intensity={1.1} luminanceThreshold={0.25} mipmapBlur />
        <ChromaticAberration
          offset={new Vector2(0.0008, 0.0008)}
          radialModulation={false}
          modulationOffset={0}
        />
      </EffectComposer>
    </Canvas>
  );
}
