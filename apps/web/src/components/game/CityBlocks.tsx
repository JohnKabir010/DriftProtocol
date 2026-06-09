"use client";

import { useMemo } from "react";
import { Object3D, InstancedMesh } from "three";
import { useRef, useLayoutEffect } from "react";

const COUNT = 120;

/** Instanced neon-window towers lining the street — one draw call. */
export function CityBlocks() {
  const mesh = useRef<InstancedMesh>(null);

  const transforms = useMemo(() => {
    // Skyline ring around the circuit (track bounds stay clear of r<135
    // from its centroid), so towers never intrude on the racing line.
    const dummy = new Object3D();
    const cx = 45;
    const cz = 100;
    return Array.from({ length: COUNT }, (_, i) => {
      const angle = (i / COUNT) * Math.PI * 2 + Math.random() * 0.1;
      const radius = 145 + Math.random() * 110;
      dummy.position.set(cx + Math.cos(angle) * radius, 0, cz + Math.sin(angle) * radius);
      const h = 12 + Math.random() * 55;
      dummy.scale.set(8 + Math.random() * 10, h, 8 + Math.random() * 10);
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
