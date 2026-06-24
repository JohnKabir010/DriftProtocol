"use client";

import { useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, MeshReflectorMaterial, Sky, Stars } from "@react-three/drei";
import {
  Bloom,
  BrightnessContrast,
  ChromaticAberration,
  EffectComposer,
  HueSaturation,
  N8AO,
  Noise,
  SMAA,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import * as THREE from "three";
import { Vector2 } from "three";
import { buildTrack, DEFAULT_TRACK_ID, TRACKS, type TrackTheme } from "@drift/shared";
import { PlayerCar } from "./PlayerCar";
import { OnlineRace } from "./OnlineRace";
import { ChaseCamera } from "./ChaseCamera";
import { CityBlocks } from "./CityBlocks";
import { Scenery } from "./scenery/Scenery";
import { NEON_TRACK_PALETTE, TrackMesh, type TrackPalette } from "./TrackMesh";

/**
 * Per-theme environment settings. Rendering metadata only — the sim is
 * identical on every theme. Day/dusk themes get a physical sky dome and
 * sun shadows; night themes get star fields and neon. Track dressing
 * (rails/stripe/asphalt) is themed so a forest road doesn't glow cyberpunk.
 */
interface ThemeConfig {
  background: string;
  fog: [color: string, near: number, far: number];
  ambient: number;
  hemisphere: { sky: string; ground: string; intensity: number };
  sun: { position: [number, number, number]; intensity: number; color: string };
  fillLights: Array<{ position: [number, number, number]; color: string; intensity: number; distance?: number }>;
  ground: { color: string; roughness: number; metalness: number };
  cityBlocks: boolean;
  envPreset: "night" | "forest" | "dawn" | "sunset";
  /** Physical sky dome (day/dusk themes). */
  sky: { sunPosition: [number, number, number]; turbidity: number; rayleigh: number } | null;
  /** Star field (night themes). */
  stars: boolean;
  palette: TrackPalette;
  /** Color grade: saturation/contrast push toward the arcade-racer look. */
  grade: { saturation: number; contrast: number };
  /** Bloom tuning. High threshold = only true HDR emitters glow (no washout). */
  bloom: { intensity: number; threshold: number };
  /** Planar reflections on the ground plane (city themes — the wet-night look). */
  groundReflect?: boolean;
  /** N8AO ambient occlusion tuning per theme. */
  ao: { intensity: number; radius: number; color: string };
}

const THEMES: Record<TrackTheme, ThemeConfig> = {
  "neon-city": {
    background: "#02040a",
    fog: ["#02040a", 80, 380],
    ambient: 0.04,
    hemisphere: { sky: "#0a1520", ground: "#020306", intensity: 0.12 },
    sun: { position: [15, 30, 10], intensity: 0.2, color: "#8ad0ff" },
    fillLights: [
      { position: [55, 7, 110], color: "#00e8ff", intensity: 5, distance: 100 },
      { position: [-25, 5, 65], color: "#ff1e8a", intensity: 4, distance: 90 },
      { position: [80, 9, 40], color: "#7b2fff", intensity: 3.5, distance: 80 },
      { position: [-60, 6, 150], color: "#00ff9d", intensity: 3, distance: 75 },
      { position: [30, 4, 180], color: "#ff6b00", intensity: 2.5, distance: 70 },
      { position: [-80, 8, 80], color: "#00b4ff", intensity: 2, distance: 65 },
    ],
    ground: { color: "#04060c", roughness: 0.28, metalness: 0.75 },
    cityBlocks: true,
    envPreset: "night",
    sky: null,
    stars: true,
    palette: {
      ...NEON_TRACK_PALETTE,
      road: { color: "#090d16", roughness: 0.42, metalness: 0.88, wet: true },
    },
    grade: { saturation: 0.12, contrast: 0.16 },
    bloom: { intensity: 0.9, threshold: 0.88 },
    groundReflect: true,
    ao: { intensity: 5, radius: 4, color: "#000814" },
  },
  "rain-city": {
    background: "#020508",
    fog: ["#030610", 45, 200],
    ambient: 0.05,
    hemisphere: { sky: "#0a1520", ground: "#020408", intensity: 0.14 },
    sun: { position: [10, 25, -5], intensity: 0.18, color: "#7aaac8" },
    fillLights: [
      { position: [50, 8, 100], color: "#ffaa30", intensity: 5.5, distance: 90 },
      { position: [-15, 6, 45], color: "#2a90ff", intensity: 4, distance: 85 },
      { position: [75, 7, 60], color: "#ff3060", intensity: 3, distance: 75 },
      { position: [-50, 5, 140], color: "#ffcc44", intensity: 3.5, distance: 80 },
      { position: [20, 4, 170], color: "#00ccff", intensity: 2.5, distance: 70 },
    ],
    ground: { color: "#030508", roughness: 0.08, metalness: 0.94 },
    cityBlocks: true,
    envPreset: "night",
    sky: null,
    stars: false,
    palette: {
      leftRail: "#ffb347",
      rightRail: "#3aa7ff",
      stripe: "#cfe4f5",
      road: { color: "#070a10", roughness: 0.22, metalness: 0.92, wet: true },
    },
    grade: { saturation: 0.06, contrast: 0.14 },
    bloom: { intensity: 0.8, threshold: 0.82 },
    groundReflect: true,
    ao: { intensity: 6, radius: 3.5, color: "#000508" },
  },
  mountain: {
    background: "#141e2c",
    fog: ["#1e2b3c", 90, 350],
    ambient: 0.24,
    hemisphere: { sky: "#8aaec8", ground: "#2e3540", intensity: 0.45 },
    sun: { position: [-40, 60, 20], intensity: 1.6, color: "#d8e8f8" },
    fillLights: [
      { position: [60, 20, 150], color: "#8ab0d0", intensity: 1.4, distance: 200 },
      { position: [-80, 30, 80], color: "#b8d0e8", intensity: 0.9, distance: 180 },
      { position: [40, 15, 50], color: "#6090c0", intensity: 0.7, distance: 150 },
    ],
    ground: { color: "#323840", roughness: 0.96, metalness: 0.04 },
    cityBlocks: false,
    envPreset: "dawn",
    sky: { sunPosition: [-40, 28, 20], turbidity: 5, rayleigh: 1.4 },
    stars: false,
    palette: {
      leftRail: "#ff4433",
      rightRail: "#f0f4f8",
      stripe: "#ffcc88",
      road: { color: "#1e2228", roughness: 0.62, metalness: 0.22 },
    },
    grade: { saturation: 0.2, contrast: 0.1 },
    bloom: { intensity: 1.1, threshold: 0.45 },
    ao: { intensity: 4, radius: 6, color: "#080c12" },
  },
  forest: {
    background: "#080e0c",
    fog: ["#0f1a14", 45, 200],
    ambient: 0.22,
    hemisphere: { sky: "#6a9878", ground: "#111e14", intensity: 0.38 },
    sun: { position: [25, 45, -10], intensity: 1.2, color: "#c8e8b0" },
    fillLights: [
      { position: [-30, 10, 120], color: "#4a7840", intensity: 1.5, distance: 160 },
      { position: [50, 8, 80], color: "#7aaa60", intensity: 1.0, distance: 140 },
      { position: [-20, 6, 50], color: "#3d6832", intensity: 0.8, distance: 120 },
    ],
    ground: { color: "#111a14", roughness: 1.0, metalness: 0.0 },
    cityBlocks: false,
    envPreset: "forest",
    sky: { sunPosition: [25, 18, -10], turbidity: 7, rayleigh: 2.0 },
    stars: false,
    palette: {
      leftRail: "#d8e8c8",
      rightRail: "#d8e8c8",
      stripe: "#f0ecb8",
      road: { color: "#181e1c", roughness: 0.78, metalness: 0.08 },
    },
    grade: { saturation: 0.22, contrast: 0.09 },
    bloom: { intensity: 0.9, threshold: 0.45 },
    ao: { intensity: 5, radius: 5, color: "#040806" },
  },
  hills: {
    background: "#160f1c",
    fog: ["#221528", 75, 280],
    ambient: 0.18,
    hemisphere: { sky: "#c06050", ground: "#1e1418", intensity: 0.35 },
    sun: { position: [-50, 35, 30], intensity: 1.4, color: "#ffa870" },
    fillLights: [
      { position: [40, 12, 90], color: "#ff6e48", intensity: 2.2, distance: 170 },
      { position: [-60, 15, 120], color: "#cc5030", intensity: 1.5, distance: 150 },
      { position: [70, 10, 50], color: "#e89060", intensity: 1.2, distance: 140 },
    ],
    ground: { color: "#1c1418", roughness: 0.82, metalness: 0.08 },
    cityBlocks: false,
    envPreset: "sunset",
    sky: { sunPosition: [-50, 8, 30], turbidity: 9, rayleigh: 3.2 },
    stars: false,
    palette: {
      leftRail: "#ff7050",
      rightRail: "#c060ff",
      stripe: "#ffcc98",
      road: { color: "#1c1620", roughness: 0.48, metalness: 0.32 },
    },
    grade: { saturation: 0.26, contrast: 0.11 },
    bloom: { intensity: 1.2, threshold: 0.42 },
    ao: { intensity: 4, radius: 5.5, color: "#0a060c" },
  },
  canyon: {
    background: "#200e06",
    fog: ["#301808", 100, 380],
    ambient: 0.28,
    hemisphere: { sky: "#e8a860", ground: "#401c0c", intensity: 0.46 },
    sun: { position: [60, 55, -20], intensity: 1.8, color: "#ffd890" },
    fillLights: [
      { position: [120, 15, 150], color: "#ff8030", intensity: 1.8, distance: 200 },
      { position: [-40, 12, 100], color: "#e87020", intensity: 1.4, distance: 180 },
      { position: [80, 20, 60], color: "#ffa858", intensity: 1.0, distance: 160 },
    ],
    ground: { color: "#401c0c", roughness: 0.92, metalness: 0.04 },
    cityBlocks: false,
    envPreset: "sunset",
    sky: { sunPosition: [60, 20, -20], turbidity: 11, rayleigh: 2.8 },
    stars: false,
    palette: {
      leftRail: "#ff9830",
      rightRail: "#ff9830",
      stripe: "#ffe0a8",
      road: { color: "#261810", roughness: 0.68, metalness: 0.18 },
    },
    grade: { saturation: 0.24, contrast: 0.12 },
    bloom: { intensity: 1.1, threshold: 0.46 },
    ao: { intensity: 5, radius: 6, color: "#100804" },
  },
};

/** Sun with a shadow frustum fitted to the track — crisp shadows, no waste. */
function SunLight({
  theme,
  center,
  extent,
}: {
  theme: ThemeConfig;
  center: { x: number; z: number };
  extent: number;
}) {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => {
    const t = new THREE.Object3D();
    t.position.set(center.x, 0, center.z);
    return t;
  }, [center]);

  const dir = new THREE.Vector3(...theme.sun.position).normalize();
  const pos: [number, number, number] = [
    center.x + dir.x * 220,
    Math.max(dir.y * 220, 60),
    center.z + dir.z * 220,
  ];
  const span = extent + 60;

  return (
    <>
      <directionalLight
        ref={lightRef}
        position={pos}
        intensity={theme.sun.intensity}
        color={theme.sun.color}
        castShadow
        target={target}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={10}
        shadow-camera-far={700}
        shadow-camera-left={-span}
        shadow-camera-right={span}
        shadow-camera-top={span}
        shadow-camera-bottom={-span}
        shadow-bias={-0.0004}
        shadow-normalBias={0.6}
      />
      <primitive object={target} />
    </>
  );
}

export default function RaceScene({
  online = false,
  trackId = DEFAULT_TRACK_ID,
  botDifficulty,
}: {
  online?: boolean;
  trackId?: string;
  botDifficulty?: "easy" | "medium" | "hard";
}) {
  const def = TRACKS[trackId] ?? TRACKS[DEFAULT_TRACK_ID]!;
  const track = useMemo(() => buildTrack(def), [def]);
  const theme = THEMES[def.theme ?? "neon-city"];

  // Track bounding box → ground placement + shadow frustum fitting.
  const bounds = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of def.controlPoints) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
    return {
      center: { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 },
      extent: Math.max(maxX - minX, maxZ - minZ) / 2,
    };
  }, [def]);

  return (
    <Canvas
      className="absolute inset-0"
      shadows="soft"
      dpr={[1, 1.5]}
      gl={{ antialias: false, powerPreference: "high-performance", logarithmicDepthBuffer: true }}
      camera={{ fov: 58, position: [0, 4, -8], near: 0.3, far: 1200 }}
    >
      <color attach="background" args={[theme.background]} />
      <fog attach="fog" args={theme.fog} />

      {/* Sky dome for day/dusk; star field for night */}
      {theme.sky && (
        <Sky
          distance={4000}
          sunPosition={theme.sky.sunPosition}
          turbidity={theme.sky.turbidity}
          rayleigh={theme.sky.rayleigh}
          mieCoefficient={0.005}
          mieDirectionalG={0.85}
        />
      )}
      {theme.stars && <Stars radius={350} depth={60} count={2500} factor={5} saturation={0.4} fade speed={0.6} />}

      <ambientLight intensity={theme.ambient} />
      <hemisphereLight
        args={[theme.hemisphere.sky, theme.hemisphere.ground, theme.hemisphere.intensity]}
      />
      <SunLight theme={theme} center={bounds.center} extent={bounds.extent} />
      {theme.fillLights.map((l, i) => (
        <pointLight key={i} position={l.position} color={l.color} intensity={l.intensity} distance={l.distance ?? 80} decay={2} />
      ))}

      {/* Ground plane: true planar reflections in the city (towers mirror in wet
          pavement), plain PBR terrain elsewhere */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[bounds.center.x, -0.05, bounds.center.z]}
        receiveShadow
      >
        <planeGeometry args={[1200, 1200]} />
        {theme.groundReflect ? (
          <MeshReflectorMaterial
            color={theme.ground.color}
            roughness={theme.ground.roughness}
            metalness={theme.ground.metalness}
            resolution={512}
            mixBlur={1.5}
            mixStrength={6}
            blur={[600, 160]}
            depthScale={0.7}
            minDepthThreshold={0.3}
            maxDepthThreshold={1.4}
            mirror={0.6}
          />
        ) : (
          <meshStandardMaterial
            color={theme.ground.color}
            roughness={theme.ground.roughness}
            metalness={theme.ground.metalness}
          />
        )}
      </mesh>

      <TrackMesh track={track} palette={theme.palette} />
      {theme.cityBlocks && <CityBlocks cx={bounds.center.x} cz={bounds.center.z} />}
      <Scenery track={track} theme={def.theme ?? "neon-city"} />
      {(online || botDifficulty) ? <OnlineRace track={track} difficulty={botDifficulty} /> : <PlayerCar track={track} />}
      <ChaseCamera />

      <Environment preset={theme.envPreset} />
      {/* multisampling={0}: SMAA handles AA with better quality at lower cost */}
      <EffectComposer multisampling={0}>
        <N8AO
          aoRadius={theme.ao.radius}
          intensity={theme.ao.intensity}
          quality="medium"
          color={theme.ao.color}
          halfRes={true}
          distanceFalloff={0.2}
        />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Bloom
          intensity={theme.bloom.intensity}
          luminanceThreshold={theme.bloom.threshold}
          luminanceSmoothing={0.2}
          mipmapBlur
        />
        <HueSaturation saturation={theme.grade.saturation} />
        <BrightnessContrast contrast={theme.grade.contrast} />
        <ChromaticAberration
          offset={new Vector2(0.00035, 0.00035)}
          radialModulation={false}
          modulationOffset={0}
        />
        <Noise opacity={0.015} blendFunction={BlendFunction.SOFT_LIGHT} />
        <Vignette eskil={false} offset={0.3} darkness={0.72} />
        <SMAA />
      </EffectComposer>
    </Canvas>
  );
}
