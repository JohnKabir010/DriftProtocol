"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const MAX_QUADS = 300;
const VERTEX_COUNT = MAX_QUADS * 4;
const INDEX_COUNT = MAX_QUADS * 6;
const HALF_WIDTH = 0.25; // half the tyre width in world units

export function Skidmarks({
  carPosition,
  carYaw,
  active,
}: {
  carPosition: THREE.Vector3;
  carYaw: number;
  active: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  const { positions, opacities, indices } = useMemo(() => {
    const positions = new Float32Array(VERTEX_COUNT * 3);
    const opacities = new Float32Array(VERTEX_COUNT);
    const indices = new Uint32Array(INDEX_COUNT);
    // Build static index buffer: each quad = 2 triangles
    for (let i = 0; i < MAX_QUADS; i++) {
      const v = i * 4;
      const idx = i * 6;
      indices[idx] = v; indices[idx + 1] = v + 1; indices[idx + 2] = v + 2;
      indices[idx + 3] = v + 2; indices[idx + 4] = v + 1; indices[idx + 5] = v + 3;
    }
    return { positions, opacities, indices };
  }, []);

  const state = useRef({
    head: 0,       // current quad write position
    prevX: 0,
    prevZ: 0,
    wasActive: false,
    age: new Float32Array(MAX_QUADS), // fade timer per quad
  });

  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const geo = mesh.geometry;
    const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
    const opAttr = geo.getAttribute("aOpacity") as THREE.BufferAttribute;
    const s = state.current;

    const rx = carPosition.x - Math.sin(carYaw) * 1.3;
    const rz = carPosition.z - Math.cos(carYaw) * 1.3;

    if (active && s.wasActive) {
      const dx = rx - s.prevX;
      const dz = rz - s.prevZ;
      const len = Math.sqrt(dx * dx + dz * dz);

      if (len > 0.05) {
        const quad = s.head % MAX_QUADS;
        s.head++;
        s.age[quad] = 0;

        // Perpendicular to travel direction = tyre width axis
        const nx = (-dz / len) * HALF_WIDTH;
        const nz = (dx / len) * HALF_WIDTH;

        const v = quad * 4;
        // Previous edge (from last frame)
        positions[v * 3]     = s.prevX - nx; positions[v * 3 + 1] = 0.02; positions[v * 3 + 2] = s.prevZ - nz;
        positions[v * 3 + 3] = s.prevX + nx; positions[v * 3 + 4] = 0.02; positions[v * 3 + 5] = s.prevZ + nz;
        // Current edge
        positions[v * 3 + 6] = rx - nx;       positions[v * 3 + 7] = 0.02; positions[v * 3 + 8] = rz - nz;
        positions[v * 3 + 9] = rx + nx;        positions[v * 3 + 10] = 0.02; positions[v * 3 + 11] = rz + nz;

        opacities[v] = opacities[v + 1] = opacities[v + 2] = opacities[v + 3] = 0.7;
      }
    }

    s.prevX = rx;
    s.prevZ = rz;
    s.wasActive = active;

    // Age all active quads
    for (let i = 0; i < MAX_QUADS; i++) {
      const age = s.age[i] ?? 8;
      if (age < 8) {
        s.age[i] = age + dt;
        const fade = Math.max(0, 1 - (age + dt) / 8);
        const v = i * 4;
        opacities[v] = opacities[v + 1] = opacities[v + 2] = opacities[v + 3] = fade * 0.7;
      }
    }

    posAttr.needsUpdate = true;
    opAttr.needsUpdate = true;
  });

  return (
    <mesh ref={meshRef} renderOrder={1}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={VERTEX_COUNT} itemSize={3} />
        <bufferAttribute attach="attributes-aOpacity" array={opacities} count={VERTEX_COUNT} itemSize={1} />
        <bufferAttribute attach="index" array={indices} count={INDEX_COUNT} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        vertexShader={`
          attribute float aOpacity;
          varying float vOpacity;
          void main() {
            vOpacity = aOpacity;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying float vOpacity;
          void main() {
            gl_FragColor = vec4(0.9, 0.2, 0.8, vOpacity);
          }
        `}
      />
    </mesh>
  );
}
