"use client";

import { forwardRef } from "react";
import { Group } from "three";

/**
 * Shared car visual (local + remote). Placeholder primitives sized to the
 * physics footprint; swaps for a GLTF model without touching sim or netcode.
 */
export const CarBody = forwardRef<Group, { accent?: string; underglow?: string; name?: string }>(
  function CarBody({ accent = "#ff2e97", underglow = "#00f0ff", name }, ref) {
    return (
      <group ref={ref} name={name}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[1.9, 0.55, 4.2]} />
          <meshStandardMaterial color="#101622" roughness={0.2} metalness={0.9} />
        </mesh>
        <mesh position={[0, 0.92, -0.4]} castShadow>
          <boxGeometry args={[1.5, 0.4, 1.9]} />
          <meshStandardMaterial color="#0a0f18" roughness={0.1} metalness={0.6} />
        </mesh>
        {/* Neon underglow + tail lights */}
        <pointLight position={[0, 0.15, 0]} color={underglow} intensity={6} distance={5} />
        <mesh position={[0, 0.55, -2.11]}>
          <boxGeometry args={[1.6, 0.12, 0.05]} />
          <meshStandardMaterial emissive={accent} emissiveIntensity={4} color="#000" />
        </mesh>
        <mesh position={[0, 0.45, 2.11]}>
          <boxGeometry args={[1.4, 0.1, 0.05]} />
          <meshStandardMaterial emissive="#aef" emissiveIntensity={2.5} color="#000" />
        </mesh>
      </group>
    );
  },
);
