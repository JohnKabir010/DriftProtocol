"use client";

import { forwardRef } from "react";
import { Group } from "three";

/**
 * Shared car visual (local + remote). Proper low-poly racing car geometry sized
 * to the physics footprint (~1.9W × 4.2L). Swap for a GLTF model without
 * touching sim or netcode.
 */
export const CarBody = forwardRef<Group, { accent?: string; underglow?: string; name?: string }>(
  function CarBody({ accent = "#ff2e97", underglow = "#00f0ff", name }, ref) {
    return (
      <group ref={ref} name={name}>
        {/* ── Main chassis ── */}
        <mesh position={[0, 0.42, 0]} castShadow>
          <boxGeometry args={[1.85, 0.5, 4.2]} />
          <meshStandardMaterial color="#0c1520" roughness={0.12} metalness={0.92} envMapIntensity={1.5} />
        </mesh>

        {/* ── Cabin / roof ── */}
        <mesh position={[0, 0.87, -0.2]} castShadow>
          <boxGeometry args={[1.3, 0.38, 2.0]} />
          <meshStandardMaterial color="#050a12" roughness={0.05} metalness={0.2} transparent opacity={0.85} />
        </mesh>

        {/* ── Front hood slope ── */}
        <mesh position={[0, 0.65, 1.3]} castShadow>
          <boxGeometry args={[1.6, 0.18, 1.2]} />
          <meshStandardMaterial color="#0c1520" roughness={0.12} metalness={0.92} envMapIntensity={1.5} />
        </mesh>

        {/* ── Rear trunk ── */}
        <mesh position={[0, 0.65, -1.7]} castShadow>
          <boxGeometry args={[1.5, 0.15, 0.9]} />
          <meshStandardMaterial color="#0c1520" roughness={0.12} metalness={0.92} envMapIntensity={1.5} />
        </mesh>

        {/* ── Wheels ── */}
        {/* Front-Left */}
        <mesh position={[0.9, 0.36, 1.4]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.36, 0.36, 0.22, 12]} />
          <meshStandardMaterial color="#111111" roughness={0.8} metalness={0.1} />
        </mesh>
        {/* Front-Right */}
        <mesh position={[-0.9, 0.36, 1.4]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.36, 0.36, 0.22, 12]} />
          <meshStandardMaterial color="#111111" roughness={0.8} metalness={0.1} />
        </mesh>
        {/* Rear-Left */}
        <mesh position={[0.9, 0.36, -1.4]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.36, 0.36, 0.22, 12]} />
          <meshStandardMaterial color="#111111" roughness={0.8} metalness={0.1} />
        </mesh>
        {/* Rear-Right */}
        <mesh position={[-0.9, 0.36, -1.4]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.36, 0.36, 0.22, 12]} />
          <meshStandardMaterial color="#111111" roughness={0.8} metalness={0.1} />
        </mesh>

        {/* ── Wheel hub caps ── */}
        <mesh position={[0.9, 0.36, 1.4]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.24, 8]} />
          <meshStandardMaterial color="#c0c8d8" roughness={0.2} metalness={0.9} />
        </mesh>
        <mesh position={[-0.9, 0.36, 1.4]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.24, 8]} />
          <meshStandardMaterial color="#c0c8d8" roughness={0.2} metalness={0.9} />
        </mesh>
        <mesh position={[0.9, 0.36, -1.4]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.24, 8]} />
          <meshStandardMaterial color="#c0c8d8" roughness={0.2} metalness={0.9} />
        </mesh>
        <mesh position={[-0.9, 0.36, -1.4]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.24, 8]} />
          <meshStandardMaterial color="#c0c8d8" roughness={0.2} metalness={0.9} />
        </mesh>

        {/* ── Front bumper ── */}
        <mesh position={[0, 0.4, 2.17]}>
          <boxGeometry args={[1.7, 0.25, 0.12]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.3} roughness={0.2} />
        </mesh>

        {/* Front bumper light strip */}
        <mesh position={[0, 0.52, 2.2]}>
          <boxGeometry args={[1.5, 0.06, 0.04]} />
          <meshStandardMaterial color="#e8f4ff" emissive="#e8f4ff" emissiveIntensity={1.5} roughness={0.1} />
        </mesh>

        {/* ── Rear diffuser ── */}
        <mesh position={[0, 0.32, -2.17]}>
          <boxGeometry args={[1.5, 0.2, 0.1]} />
          <meshStandardMaterial color={accent} emissive={underglow} emissiveIntensity={1.2} roughness={0.3} />
        </mesh>

        {/* ── Tail lights ── */}
        <mesh position={[0.55, 0.55, -2.16]}>
          <boxGeometry args={[0.35, 0.1, 0.04]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={5} roughness={0.1} />
        </mesh>
        <mesh position={[-0.55, 0.55, -2.16]}>
          <boxGeometry args={[0.35, 0.1, 0.04]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={5} roughness={0.1} />
        </mesh>

        {/* ── Lighting ── */}
        {/* Underglow */}
        <pointLight position={[0, 0.1, 0]} color={underglow} intensity={8} distance={6} decay={2} />
        {/* Headlights */}
        <pointLight position={[0.55, 0.52, 2.3]} color="#e8f0ff" intensity={12} distance={18} decay={2} />
        <pointLight position={[-0.55, 0.52, 2.3]} color="#e8f0ff" intensity={12} distance={18} decay={2} />
      </group>
    );
  },
);
