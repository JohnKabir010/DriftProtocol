"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ScatterPoint } from "./scatter";

/**
 * Low-poly instanced scenery primitives. Each component is one or two draw
 * calls regardless of count; nothing here casts shadows or animates, so the
 * whole environment costs a handful of milliseconds of setup and almost
 * nothing per frame.
 */

function useInstances(matrices: THREE.Matrix4[]) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    matrices.forEach((matrix, i) => m.setMatrixAt(i, matrix));
    m.instanceMatrix.needsUpdate = true;
  }, [matrices]);
  return ref;
}

const dummy = new THREE.Object3D();

function matrixAt(
  p: ScatterPoint,
  y: number,
  scale: [number, number, number],
  rotY = 0,
): THREE.Matrix4 {
  dummy.position.set(p.x, y, p.z);
  dummy.scale.set(...scale);
  dummy.rotation.set(0, rotY, 0);
  dummy.updateMatrix();
  return dummy.matrix.clone();
}

/**
 * Conifers: instanced trunk + three stacked canopy tiers. Three progressively
 * smaller cones per tree reads as a real spruce silhouette, adding a lot of
 * visual richness for the same draw-call cost as single-cone trees.
 */
export function PineTrees({
  points,
  canopyColor = "#1d3a24",
  trunkColor = "#2b2017",
  scale = 1,
}: {
  points: ScatterPoint[];
  canopyColor?: string;
  trunkColor?: string;
  scale?: number;
}) {
  const { trunks, tier1, tier2, tier3 } = useMemo(() => {
    const trunks: THREE.Matrix4[] = [];
    const tier1: THREE.Matrix4[] = [];
    const tier2: THREE.Matrix4[] = [];
    const tier3: THREE.Matrix4[] = [];
    for (const p of points) {
      const s = (0.65 + p.r * 0.85) * scale;
      const trunkH = 1.8 * s;
      // Bottom tier — widest
      const h1 = 4.0 * s;
      const h2 = 3.0 * s;
      const h3 = 2.0 * s;
      const base = trunkH * 0.7;
      trunks.push(matrixAt(p, trunkH / 2, [0.32 * s, trunkH, 0.32 * s]));
      tier1.push(matrixAt({ ...p }, base + h1 / 2,          [2.4 * s, h1, 2.4 * s], p.r * Math.PI));
      tier2.push(matrixAt({ ...p }, base + h1 * 0.55 + h2 / 2, [1.7 * s, h2, 1.7 * s], p.r * Math.PI + 0.4));
      tier3.push(matrixAt({ ...p }, base + h1 * 0.85 + h3 / 2, [1.0 * s, h3, 1.0 * s], p.r * Math.PI + 0.8));
    }
    return { trunks, tier1, tier2, tier3 };
  }, [points, scale]);

  const trunkRef = useInstances(trunks);
  const t1Ref    = useInstances(tier1);
  const t2Ref    = useInstances(tier2);
  const t3Ref    = useInstances(tier3);

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, trunks.length]} castShadow>
        <cylinderGeometry args={[0.5, 0.7, 1, 5]} />
        <meshStandardMaterial color={trunkColor} roughness={1} />
      </instancedMesh>
      <instancedMesh ref={t1Ref} args={[undefined, undefined, tier1.length]} castShadow>
        <coneGeometry args={[1, 1, 7]} />
        <meshStandardMaterial color={canopyColor} roughness={0.95} flatShading />
      </instancedMesh>
      <instancedMesh ref={t2Ref} args={[undefined, undefined, tier2.length]}>
        <coneGeometry args={[1, 1, 7]} />
        <meshStandardMaterial color={canopyColor} roughness={0.95} flatShading />
      </instancedMesh>
      <instancedMesh ref={t3Ref} args={[undefined, undefined, tier3.length]}>
        <coneGeometry args={[1, 1, 7]} />
        <meshStandardMaterial color={canopyColor} roughness={0.95} flatShading />
      </instancedMesh>
    </group>
  );
}

/** Grass cover: instanced crossed blades, color-jittered. One draw call. */
export function GrassTufts({
  points,
  color = "#2f4a2c",
}: {
  points: ScatterPoint[];
  color?: string;
}) {
  const matrices = useMemo(
    () =>
      points.map((p) => {
        const s = 0.5 + p.r * 0.9;
        return matrixAt(p, 0.45 * s, [s, s, s], p.r * Math.PI * 2);
      }),
    [points],
  );
  const ref = useInstances(matrices);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, matrices.length]}>
      <coneGeometry args={[0.5, 1, 4]} />
      <meshStandardMaterial color={color} roughness={1} flatShading />
    </instancedMesh>
  );
}

/** Boulders: irregular dodecahedra with non-uniform squash. */
export function Rocks({ points, color = "#4d4a45" }: { points: ScatterPoint[]; color?: string }) {
  const matrices = useMemo(
    () =>
      points.map((p) => {
        const s = 0.6 + p.r * 2.2;
        return matrixAt(p, s * 0.3, [s, s * (0.5 + p.r * 0.5), s * (0.7 + p.r * 0.6)], p.r * Math.PI * 2);
      }),
    [points],
  );
  const ref = useInstances(matrices);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, matrices.length]} castShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={color} roughness={1} flatShading />
    </instancedMesh>
  );
}

/** Rolling hill mounds: squashed spheres sunk into the ground plane. */
export function Mounds({ points, color = "#241c26" }: { points: ScatterPoint[]; color?: string }) {
  const matrices = useMemo(
    () =>
      points.map((p) => {
        const s = 14 + p.r * 30;
        const h = 0.18 + p.r * 0.14;
        return matrixAt(p, -s * h * 0.25, [s, s * h, s * (0.8 + p.r * 0.4)], p.r * Math.PI);
      }),
    [points],
  );
  const ref = useInstances(matrices);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, matrices.length]}>
      <sphereGeometry args={[1, 12, 8]} />
      <meshStandardMaterial color={color} roughness={1} />
    </instancedMesh>
  );
}

/** Distant peak ring: big faceted cones, optional snow caps on the tallest. */
export function Peaks({
  points,
  color,
  snowColor,
  minHeight = 50,
  maxHeight = 120,
}: {
  points: ScatterPoint[];
  color: string;
  snowColor?: string;
  minHeight?: number;
  maxHeight?: number;
}) {
  const { bodies, caps } = useMemo(() => {
    const bodies: THREE.Matrix4[] = [];
    const caps: THREE.Matrix4[] = [];
    for (const p of points) {
      const h = minHeight + p.r * (maxHeight - minHeight);
      const w = h * (0.9 + p.r * 0.5);
      bodies.push(matrixAt(p, h / 2, [w, h, w], p.r * Math.PI * 2));
      // Snow cap: a small white cone capping peaks in the upper half of the range.
      if (snowColor && h > minHeight + (maxHeight - minHeight) * 0.45) {
        const capH = h * 0.28;
        caps.push(matrixAt(p, h - capH / 2 + 0.5, [w * 0.3, capH, w * 0.3], p.r * Math.PI * 2));
      }
    }
    return { bodies, caps };
  }, [points, minHeight, maxHeight, snowColor]);

  const bodyRef = useInstances(bodies);
  const capRef = useInstances(caps);

  return (
    <group>
      <instancedMesh ref={bodyRef} args={[undefined, undefined, bodies.length]}>
        <coneGeometry args={[1, 1, 7]} />
        <meshStandardMaterial color={color} roughness={1} flatShading />
      </instancedMesh>
      {snowColor && caps.length > 0 && (
        <instancedMesh ref={capRef} args={[undefined, undefined, caps.length]}>
          <coneGeometry args={[1, 1, 7]} />
          <meshStandardMaterial color={snowColor} roughness={0.6} flatShading />
        </instancedMesh>
      )}
    </group>
  );
}

/** Still water: dark mirror discs (ponds, river bends, harbor basins). */
export function WaterPatches({
  points,
  color = "#0a1622",
}: {
  points: ScatterPoint[];
  color?: string;
}) {
  return (
    <group>
      {points.map((p, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[p.x, 0.02, p.z]}>
          <circleGeometry args={[14 + p.r * 22, 24]} />
          <meshStandardMaterial color={color} roughness={0.02} metalness={0.9} envMapIntensity={1.5} />
        </mesh>
      ))}
    </group>
  );
}
