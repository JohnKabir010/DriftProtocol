"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, Grid } from "@react-three/drei";
import { Bloom, ChromaticAberration, EffectComposer } from "@react-three/postprocessing";
import { PlayerCar } from "./PlayerCar";
import { ChaseCamera } from "./ChaseCamera";
import { CityBlocks } from "./CityBlocks";

/**
 * Phase-1 scene: neon grid street, instanced city blocks, drivable car with
 * keyboard input, chase camera, and the post stack (bloom + subtle CA).
 * Rapier vehicle physics and netcode sync replace the local kinematic
 * controller in Phase 2 — the scene graph stays the same.
 */
export default function RaceScene() {
  return (
    <Canvas
      className="absolute inset-0"
      dpr={[1, 1.75]}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      camera={{ fov: 60, position: [0, 4, -8] }}
    >
      <color attach="background" args={["#0A0E17"]} />
      <fog attach="fog" args={["#0A0E17", 40, 160]} />

      <ambientLight intensity={0.15} />
      <directionalLight position={[10, 20, 5]} intensity={0.3} color="#7df" />

      {/* Wet-asphalt stand-in: dark reflective plane + neon grid overlay */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#0b0f1a" roughness={0.25} metalness={0.7} />
      </mesh>
      <Grid
        position={[0, 0.01, 0]}
        args={[400, 400]}
        cellSize={4}
        cellColor="#0d2a33"
        sectionSize={20}
        sectionColor="#00f0ff"
        fadeDistance={150}
        infiniteGrid
      />

      <CityBlocks />
      <PlayerCar />
      <ChaseCamera />

      <Environment preset="night" />
      <EffectComposer>
        <Bloom intensity={1.1} luminanceThreshold={0.25} mipmapBlur />
        <ChromaticAberration offset={[0.0008, 0.0008]} />
      </EffectComposer>
    </Canvas>
  );
}
