"use client";

import { useMemo } from "react";
import { BufferAttribute, BufferGeometry } from "three";
import { Track, poseAtS } from "@drift/shared";

/** Build an indexed ribbon geometry between two lateral offsets of the centerline. */
function buildRibbon(track: Track, innerOff: number, outerOff: number, y: number): BufferGeometry {
  const n = track.samples.length;
  const positions = new Float32Array(n * 2 * 3);
  const indices: number[] = [];

  for (let i = 0; i < n; i++) {
    const s = track.samples[i]!;
    // Left normal of travel direction.
    const nx = -s.dirZ;
    const nz = s.dirX;
    positions.set([s.x + nx * innerOff, y, s.z + nz * innerOff], i * 6);
    positions.set([s.x + nx * outerOff, y, s.z + nz * outerOff], i * 6 + 3);
    const a = i * 2;
    const b = ((i + 1) % n) * 2; // closed loop wraps to the first pair
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }

  const geom = new BufferGeometry();
  geom.setAttribute("position", new BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function CheckpointGate({ track, s, isStart }: { track: Track; s: number; isStart: boolean }) {
  const pose = poseAtS(track, s);
  const w = track.halfWidth + 0.8;
  const color = isStart ? "#ccff00" : "#00f0ff";
  return (
    <group position={[pose.x, 0, pose.z]} rotation={[0, pose.yaw, 0]}>
      {[-w, w].map((off) => (
        <mesh key={off} position={[off, 2.5, 0]}>
          <boxGeometry args={[0.3, 5, 0.3]} />
          <meshStandardMaterial emissive={color} emissiveIntensity={1.5} color="#0a0f18" />
        </mesh>
      ))}
      <mesh position={[0, 5.1, 0]}>
        <boxGeometry args={[w * 2 + 0.3, 0.35, 0.35]} />
        <meshStandardMaterial emissive={color} emissiveIntensity={2.5} color="#0a0f18" />
      </mesh>
    </group>
  );
}

/** Road surface, neon edge rails, and checkpoint gates — all from track data. */
export function TrackMesh({ track }: { track: Track }) {
  const hw = track.halfWidth;
  const { road, leftRail, rightRail } = useMemo(
    () => ({
      road: buildRibbon(track, hw, -hw, 0.02),
      leftRail: buildRibbon(track, hw + 0.45, hw, 0.06),
      rightRail: buildRibbon(track, -hw, -hw - 0.45, 0.06),
    }),
    [track, hw],
  );

  return (
    <group>
      <mesh geometry={road} receiveShadow>
        <meshStandardMaterial color="#11161f" roughness={0.35} metalness={0.55} />
      </mesh>
      <mesh geometry={leftRail}>
        <meshStandardMaterial emissive="#00f0ff" emissiveIntensity={2.2} color="#001418" />
      </mesh>
      <mesh geometry={rightRail}>
        <meshStandardMaterial emissive="#ff2e97" emissiveIntensity={2.2} color="#180012" />
      </mesh>
      {track.checkpoints.map((s, i) => (
        <CheckpointGate key={i} track={track} s={s} isStart={i === track.checkpoints.length - 1} />
      ))}
    </group>
  );
}
