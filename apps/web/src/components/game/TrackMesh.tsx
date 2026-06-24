"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry } from "three";
import { Track, poseAtS } from "@drift/shared";
import { createWetAsphaltMaterial } from "./WetAsphalt";

/** Build an indexed ribbon geometry between two lateral offsets of the centerline. */
function buildRibbon(track: Track, innerOff: number, outerOff: number, y: number): BufferGeometry {
  const n = track.samples.length;
  const positions = new Float32Array(n * 2 * 3);
  const indices: number[] = [];

  const uvs = new Float32Array(n * 2 * 2);
  for (let i = 0; i < n; i++) {
    const s = track.samples[i]!;
    // Left normal of travel direction.
    const nx = -s.dirZ;
    const nz = s.dirX;
    positions.set([s.x + nx * innerOff, y, s.z + nz * innerOff], i * 6);
    positions.set([s.x + nx * outerOff, y, s.z + nz * outerOff], i * 6 + 3);
    // u = arc position in ~8m tiles, v = 0..1 across the width — the wet
    // asphalt shader uses v for tire-wear bands and edge erosion.
    uvs.set([s.s / 8, 0], i * 4);
    uvs.set([s.s / 8, 1], i * 4 + 2);
    const a = i * 2;
    const b = ((i + 1) % n) * 2; // closed loop wraps to the first pair
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }

  const geom = new BufferGeometry();
  geom.setAttribute("position", new BufferAttribute(positions, 3));
  geom.setAttribute("uv", new BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function CheckpointGate({ track, s, isStart }: { track: Track; s: number; isStart: boolean }) {
  const pose = poseAtS(track, s);
  const w = track.halfWidth + 1.0;
  const color = isStart ? "#ccff00" : "#00f0ff";
  const dim   = isStart ? "#88aa00" : "#006888";
  return (
    <group position={[pose.x, 0, pose.z]} rotation={[0, pose.yaw, 0]}>
      {/* Outer structural pillars */}
      {[-w, w].map((off) => (
        <group key={off}>
          <mesh position={[off, 3.5, 0]}>
            <boxGeometry args={[0.5, 7, 0.5]} />
            <meshStandardMaterial color="#0a0f18" roughness={0.4} metalness={0.8} />
          </mesh>
          {/* Emissive trim strip on pillar */}
          <mesh position={[off, 3.5, 0.27]}>
            <boxGeometry args={[0.12, 6.8, 0.06]} />
            <meshStandardMaterial emissive={color} emissiveIntensity={3} color="#060c14" />
          </mesh>
          {/* Top cap */}
          <mesh position={[off, 7.2, 0]}>
            <boxGeometry args={[0.9, 0.4, 0.9]} />
            <meshStandardMaterial emissive={color} emissiveIntensity={4} color="#060c14" />
          </mesh>
        </group>
      ))}
      {/* Main crossbar */}
      <mesh position={[0, 7.1, 0]}>
        <boxGeometry args={[w * 2 + 0.5, 0.4, 0.4]} />
        <meshStandardMaterial color="#0a0f18" roughness={0.4} metalness={0.8} />
      </mesh>
      {/* Emissive crossbar face */}
      <mesh position={[0, 7.1, 0.22]}>
        <boxGeometry args={[w * 2 + 0.4, 0.22, 0.06]} />
        <meshStandardMaterial emissive={color} emissiveIntensity={5} color="#060c14" />
      </mesh>
      {/* Sub-beam at mid height for an archway look */}
      <mesh position={[0, 3.8, 0]}>
        <boxGeometry args={[w * 2 + 0.3, 0.22, 0.22]} />
        <meshStandardMaterial emissive={dim} emissiveIntensity={2} color="#060c14" />
      </mesh>
    </group>
  );
}

export interface TrackPalette {
  leftRail: string;
  rightRail: string;
  /** Dashed-feel center stripe; keep dim so it reads as paint, not neon. */
  stripe: string;
  /** Road material — wet asphalt in the city, matte tarmac in nature. */
  road: { color: string; roughness: number; metalness: number; wet?: boolean };
}

export const NEON_TRACK_PALETTE: TrackPalette = {
  leftRail: "#00f0ff",
  rightRail: "#ff2e97",
  stripe: "#9adfff",
  road: { color: "#090d16", roughness: 0.08, metalness: 0.92 },
};

/** Road surface, themed edge rails, center stripe, and checkpoint gates. */
export function TrackMesh({
  track,
  palette = NEON_TRACK_PALETTE,
}: {
  track: Track;
  palette?: TrackPalette;
}) {
  const hw = track.halfWidth;
  const { road, leftRail, rightRail, stripe, leftShoulder, rightShoulder, leftRumble, rightRumble } = useMemo(
    () => ({
      road:           buildRibbon(track, hw,         -hw,         0.02),
      leftRail:       buildRibbon(track, hw + 0.45,  hw,          0.06),
      rightRail:      buildRibbon(track, -hw,        -hw - 0.45,  0.06),
      stripe:         buildRibbon(track, 0.18,       -0.18,       0.03),
      // Road shoulders — grungy compressed gravel strips outside the tarmac
      leftShoulder:   buildRibbon(track, hw + 0.45,  hw + 3.2,    0.0),
      rightShoulder:  buildRibbon(track, -hw - 0.45, -hw - 3.2,   0.0),
      // Rumble strips — alternating hazard-band insets just inside the rails
      leftRumble:     buildRibbon(track, hw - 0.05,  hw - 0.5,    0.04),
      rightRumble:    buildRibbon(track, -hw + 0.5,  -hw + 0.05,  0.04),
    }),
    [track, hw],
  );

  // Multilayer wet-asphalt shader (city themes) — created once per palette.
  const wetMaterial = useMemo(
    () => (palette.road.wet ? createWetAsphaltMaterial(palette.road.color) : null),
    [palette.road.wet, palette.road.color],
  );
  useFrame((_, delta) => {
    const shader = wetMaterial?.userData.shader as { uniforms: { uTime: { value: number } } } | undefined;
    if (shader) shader.uniforms.uTime.value += delta;
  });

  return (
    <group>
      {/* Road shoulders — terrain integration strip */}
      <mesh geometry={leftShoulder} receiveShadow>
        <meshStandardMaterial color="#14100c" roughness={0.97} metalness={0.02} />
      </mesh>
      <mesh geometry={rightShoulder} receiveShadow>
        <meshStandardMaterial color="#14100c" roughness={0.97} metalness={0.02} />
      </mesh>

      {/* Rumble strips — hazard yellow */}
      <mesh geometry={leftRumble}>
        <meshStandardMaterial color="#cc8800" roughness={0.6} metalness={0.1} emissive="#553300" emissiveIntensity={0.3} />
      </mesh>
      <mesh geometry={rightRumble}>
        <meshStandardMaterial color="#cc8800" roughness={0.6} metalness={0.1} emissive="#553300" emissiveIntensity={0.3} />
      </mesh>

      {/* Main road surface */}
      <mesh geometry={road} receiveShadow {...(wetMaterial ? { material: wetMaterial } : {})}>
        {!wetMaterial && (
          <meshStandardMaterial
            color={palette.road.color}
            roughness={palette.road.roughness}
            metalness={palette.road.metalness}
            envMapIntensity={2.2}
          />
        )}
      </mesh>

      {/* Edge rails */}
      <mesh geometry={leftRail}>
        <meshStandardMaterial emissive={palette.leftRail} emissiveIntensity={4} color="#060b14" />
      </mesh>
      <mesh geometry={rightRail}>
        <meshStandardMaterial emissive={palette.rightRail} emissiveIntensity={4} color="#060b14" />
      </mesh>

      {/* Centre stripe */}
      <mesh geometry={stripe}>
        <meshStandardMaterial emissive={palette.stripe} emissiveIntensity={0.9} color="#0c0c0c" />
      </mesh>

      {track.checkpoints.map((s, i) => (
        <CheckpointGate key={i} track={track} s={s} isStart={i === track.checkpoints.length - 1} />
      ))}
    </group>
  );
}
