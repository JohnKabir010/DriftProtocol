"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Track } from "@drift/shared";
import { corridorPoints, mulberry32, hashSeed, ringPoints } from "./scatter";

/**
 * Canyon environment: stratified rock walls flanking the road corridor plus a
 * ring of distant mesas. Walls follow the racing line via corridorPoints, so
 * every layout reads as a carved canyon without hand-placed geometry.
 */
export function CanyonWalls({ track }: { track: Track }) {
  const { walls, mesas } = useMemo(() => {
    const rng = mulberry32(hashSeed(`${track.def.id}:canyon`));
    const dummy = new THREE.Object3D();

    const walls = corridorPoints(track, rng, {
      spacing: 16,
      minOffset: track.halfWidth + 9,
      maxOffset: track.halfWidth + 22,
    }).map((p) => {
      const h = 10 + p.r * 22;
      const w = 8 + p.r * 10;
      dummy.position.set(p.x, h / 2 - 1, p.z);
      dummy.scale.set(w, h, 6 + p.r * 6);
      dummy.rotation.set(0, p.yaw + (p.r - 0.5) * 0.5, 0);
      dummy.updateMatrix();
      return dummy.matrix.clone();
    });

    const mesas = ringPoints(track, rng, { count: 14, minRadius: 230, maxRadius: 330 }).map((p) => {
      const h = 35 + p.r * 45;
      const w = 40 + p.r * 50;
      dummy.position.set(p.x, h / 2, p.z);
      dummy.scale.set(w, h, w * (0.6 + p.r * 0.5));
      dummy.rotation.set(0, p.r * Math.PI * 2, 0);
      dummy.updateMatrix();
      return dummy.matrix.clone();
    });

    return { walls, mesas };
  }, [track]);

  const wallRef = useRef<THREE.InstancedMesh>(null);
  const mesaRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    if (wallRef.current) {
      walls.forEach((m, i) => wallRef.current!.setMatrixAt(i, m));
      wallRef.current.instanceMatrix.needsUpdate = true;
    }
    if (mesaRef.current) {
      mesas.forEach((m, i) => mesaRef.current!.setMatrixAt(i, m));
      mesaRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [walls, mesas]);

  return (
    <group>
      <instancedMesh ref={wallRef} args={[undefined, undefined, walls.length]} castShadow>
        <boxGeometry />
        <meshStandardMaterial color="#6e3a20" roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={mesaRef} args={[undefined, undefined, mesas.length]}>
        <cylinderGeometry args={[0.7, 1, 1, 8]} />
        <meshStandardMaterial color="#5a2e18" roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}
