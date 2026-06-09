"use client";

import { useMemo } from "react";
import { Object3D, InstancedMesh } from "three";
import { useRef, useLayoutEffect } from "react";

const COUNT = 120;

/** Instanced neon-window towers lining the street — one draw call. */
export function CityBlocks() {
  const mesh = useRef<InstancedMesh>(null);

  const transforms = useMemo(() => {
    const dummy = new Object3D();
    return Array.from({ length: COUNT }, (_, i) => {
      const side = i % 2 === 0 ? 1 : -1;
      dummy.position.set(side * (18 + Math.random() * 30), 0, (i / 2) * 14 - 80 + Math.random() * 6);
      const h = 10 + Math.random() * 40;
      dummy.scale.set(6 + Math.random() * 8, h, 6 + Math.random() * 8);
      dummy.position.y = h / 2;
      dummy.updateMatrix();
      return dummy.matrix.clone();
    });
  }, []);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    transforms.forEach((matrix, i) => m.setMatrixAt(i, matrix));
    m.instanceMatrix.needsUpdate = true;
  }, [transforms]);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]}>
      <boxGeometry />
      <meshStandardMaterial color="#0d1320" emissive="#123" emissiveIntensity={0.6} roughness={0.8} />
    </instancedMesh>
  );
}
