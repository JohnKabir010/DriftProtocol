"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Track } from "@drift/shared";
import { hashSeed, mulberry32, trackBounds } from "./scatter";

const DROP_COUNT = 1400;
const AREA = 320; // rain volume side length, centered on the track
const CEILING = 45;
const FALL_SPEED = 38; // m/s — heavy downpour

/**
 * Rain as a single Points cloud over the track area. One draw call; the only
 * per-frame work is a y-decrement over a Float32Array. Streak illusion comes
 * from speed + additive blending against the dark scene, not from geometry.
 */
export function Rain({ track }: { track: Track }) {
  const pointsRef = useRef<THREE.Points>(null);
  const center = useMemo(() => trackBounds(track), [track]);

  const positions = useMemo(() => {
    const rng = mulberry32(hashSeed(`${track.def.id}:rain`));
    const arr = new Float32Array(DROP_COUNT * 3);
    for (let i = 0; i < DROP_COUNT; i++) {
      arr[i * 3] = center.cx + (rng() - 0.5) * AREA;
      arr[i * 3 + 1] = rng() * CEILING;
      arr[i * 3 + 2] = center.cz + (rng() - 0.5) * AREA;
    }
    return arr;
  }, [track, center]);

  useFrame((_, delta) => {
    const geom = pointsRef.current?.geometry;
    if (!geom) return;
    const pos = geom.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const fall = FALL_SPEED * Math.min(delta, 0.1);
    for (let i = 0; i < DROP_COUNT; i++) {
      const yi = i * 3 + 1;
      arr[yi] = arr[yi]! - fall;
      if (arr[yi]! < 0) arr[yi] = CEILING;
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#8fb8d8"
        size={0.12}
        transparent
        opacity={0.55}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
