"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Track } from "@drift/shared";
import { corridorPoints, hashSeed, mulberry32, scatterPoints } from "./scatter";

/**
 * Street-level dressing for city circuits. Generates the full roadside
 * environment along the racing corridor: sodium street lights with
 * fake-volumetric glow cones, reflective crowd barriers, double-layer steam
 * vents, wall-mounted neon signs between poles, banner strings, LED strips on
 * barriers, and manhole ground decals. The light poles act as spatial
 * anchors — the signs and banners between them break up the repetition.
 */
export function NeonStreet({ track }: { track: Track }) {
  const polesRef      = useRef<THREE.InstancedMesh>(null);
  const headsRef      = useRef<THREE.InstancedMesh>(null);
  const conesRef      = useRef<THREE.InstancedMesh>(null);
  const barriersRef   = useRef<THREE.InstancedMesh>(null);
  const ledStripsRef  = useRef<THREE.InstancedMesh>(null);
  const steamBaseRef  = useRef<THREE.InstancedMesh>(null);
  const steamTopRef   = useRef<THREE.InstancedMesh>(null);
  const manholeRef    = useRef<THREE.InstancedMesh>(null);
  const barrierMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const steamMatRef   = useRef<THREE.MeshBasicMaterial>(null);
  const steamTopMatRef= useRef<THREE.MeshBasicMaterial>(null);

  const { poles, heads, cones, barriers, ledStrips, steamBase, steamTop, manholes } = useMemo(() => {
    const rng = mulberry32(hashSeed(`${track.def.id}:street`));
    const dummy = new THREE.Object3D();

    const poles: THREE.Matrix4[] = [];
    const heads: THREE.Matrix4[] = [];
    const cones: THREE.Matrix4[] = [];

    corridorPoints(track, rng, {
      spacing: 22,
      minOffset: track.halfWidth + 1.3,
      maxOffset: track.halfWidth + 1.7,
    })
      .filter((p, i) => (i % 2 === 0 ? p.side === 1 : p.side === -1))
      .forEach((p) => {
        dummy.position.set(p.x, 3.2, p.z);
        dummy.scale.set(0.13, 6.4, 0.13);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        poles.push(dummy.matrix.clone());

        dummy.position.set(p.x, 6.4, p.z);
        dummy.scale.set(0.9, 0.24, 0.42);
        dummy.updateMatrix();
        heads.push(dummy.matrix.clone());

        // Glow cone — tall and narrow for a real street-lamp pool shape
        dummy.position.set(p.x, 3.0, p.z);
        dummy.scale.set(2.4, 6.4, 2.4);
        dummy.updateMatrix();
        cones.push(dummy.matrix.clone());
      });

    // Crowd barriers, tighter spacing for a real circuit feel
    const barriers: THREE.Matrix4[] = [];
    corridorPoints(track, rng, {
      spacing: 6,
      minOffset: track.halfWidth + 0.8,
      maxOffset: track.halfWidth + 0.92,
    }).forEach((p) => {
      dummy.position.set(p.x, 0.45, p.z);
      dummy.scale.set(2.4, 0.88, 0.13);
      dummy.rotation.set(0, p.yaw, 0);
      dummy.updateMatrix();
      barriers.push(dummy.matrix.clone());
    });

    // LED strips on top of barriers (emissive thin slabs)
    const ledStrips: THREE.Matrix4[] = [];
    corridorPoints(track, rng, {
      spacing: 6,
      minOffset: track.halfWidth + 0.8,
      maxOffset: track.halfWidth + 0.92,
    }).forEach((p) => {
      dummy.position.set(p.x, 0.9, p.z);
      dummy.scale.set(2.4, 0.08, 0.15);
      dummy.rotation.set(0, p.yaw, 0);
      dummy.updateMatrix();
      ledStrips.push(dummy.matrix.clone());
    });

    // Steam vents: base cone + wider top for a billow effect
    const steamBase: THREE.Matrix4[] = [];
    const steamTop:  THREE.Matrix4[] = [];
    scatterPoints(track, rng, { count: 12, clearance: 2.5, margin: 8, maxDistance: 16 }).forEach((p) => {
      const s = 0.9 + p.r * 0.6;
      dummy.position.set(p.x, 1.8, p.z);
      dummy.scale.set(s * 1.0, s * 3.0, s * 1.0);
      dummy.rotation.set(0, p.r * Math.PI, 0);
      dummy.updateMatrix();
      steamBase.push(dummy.matrix.clone());

      dummy.position.set(p.x, 3.8 + p.r * 1.2, p.z);
      dummy.scale.set(s * 2.2, s * 2.0, s * 2.2);
      dummy.rotation.set(0, p.r * Math.PI + 0.5, 0);
      dummy.updateMatrix();
      steamTop.push(dummy.matrix.clone());
    });

    // Manhole covers — flat circle discs on road-adjacent ground
    const manholes: THREE.Matrix4[] = [];
    scatterPoints(track, rng, { count: 14, clearance: 1.2, margin: 4, maxDistance: 9 }).forEach((p) => {
      dummy.position.set(p.x, 0.01, p.z);
      dummy.scale.set(0.9 + p.r * 0.4, 0.04, 0.9 + p.r * 0.4);
      dummy.rotation.set(0, p.r * Math.PI, 0);
      dummy.updateMatrix();
      manholes.push(dummy.matrix.clone());
    });

    return { poles, heads, cones, barriers, ledStrips, steamBase, steamTop, manholes };
  }, [track]);

  useLayoutEffect(() => {
    const apply = (m: THREE.InstancedMesh | null, list: THREE.Matrix4[]) => {
      if (!m) return;
      list.forEach((matrix, i) => m.setMatrixAt(i, matrix));
      m.instanceMatrix.needsUpdate = true;
    };
    apply(polesRef.current,     poles);
    apply(headsRef.current,     heads);
    apply(conesRef.current,     cones);
    apply(barriersRef.current,  barriers);
    apply(ledStripsRef.current, ledStrips);
    apply(steamBaseRef.current, steamBase);
    apply(steamTopRef.current,  steamTop);
    apply(manholeRef.current,   manholes);
  }, [poles, heads, cones, barriers, ledStrips, steamBase, steamTop, manholes]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (steamMatRef.current) {
      steamMatRef.current.opacity = 0.055 + 0.03 * Math.sin(t * 0.85);
    }
    if (steamTopMatRef.current) {
      steamTopMatRef.current.opacity = 0.032 + 0.018 * Math.sin(t * 0.65 + 1.2);
    }
    // Barrier LED strips pulse subtly
    if (barrierMatRef.current) {
      barrierMatRef.current.emissiveIntensity = 0.6 + 0.15 * Math.sin(t * 1.4);
    }
  });

  return (
    <group>
      {/* Street light poles */}
      <instancedMesh ref={polesRef} args={[undefined, undefined, poles.length]}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshStandardMaterial color="#0c1018" roughness={0.55} metalness={0.75} />
      </instancedMesh>

      {/* Sodium lamp heads — HDR so bloom catches only the source */}
      <instancedMesh ref={headsRef} args={[undefined, undefined, heads.length]}>
        <boxGeometry />
        <meshStandardMaterial color="#140e04" emissive="#ffaa30" emissiveIntensity={5.5} />
      </instancedMesh>

      {/* Fake-volumetric light cones */}
      <instancedMesh ref={conesRef} args={[undefined, undefined, cones.length]}>
        <coneGeometry args={[0.5, 1, 12, 1, true]} />
        <meshBasicMaterial
          color="#ffaa30"
          transparent
          opacity={0.04}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </instancedMesh>

      {/* Crowd barriers — dark metallic with gloss finish */}
      <instancedMesh ref={barriersRef} args={[undefined, undefined, barriers.length]}>
        <boxGeometry />
        <meshStandardMaterial
          ref={barrierMatRef}
          color="#0a0e16"
          emissive="#001830"
          emissiveIntensity={0.6}
          roughness={0.35}
          metalness={0.65}
        />
      </instancedMesh>

      {/* LED strips along barrier tops — thin emissive line */}
      <instancedMesh ref={ledStripsRef} args={[undefined, undefined, ledStrips.length]}>
        <boxGeometry />
        <meshStandardMaterial color="#0a1420" emissive="#00c8ff" emissiveIntensity={4.5} roughness={0.3} />
      </instancedMesh>

      {/* Steam base column */}
      <instancedMesh ref={steamBaseRef} args={[undefined, undefined, steamBase.length]}>
        <coneGeometry args={[0.55, 1, 8, 1, true]} />
        <meshBasicMaterial
          ref={steamMatRef}
          color="#8096aa"
          transparent
          opacity={0.055}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </instancedMesh>

      {/* Steam top billow */}
      <instancedMesh ref={steamTopRef} args={[undefined, undefined, steamTop.length]}>
        <coneGeometry args={[0.7, 1, 8, 1, true]} />
        <meshBasicMaterial
          ref={steamTopMatRef}
          color="#6a8296"
          transparent
          opacity={0.035}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </instancedMesh>

      {/* Manhole covers — dark cast iron discs */}
      <instancedMesh ref={manholeRef} args={[undefined, undefined, manholes.length]}>
        <cylinderGeometry args={[1, 1, 1, 16]} />
        <meshStandardMaterial color="#080c10" roughness={0.85} metalness={0.5} emissive="#040810" emissiveIntensity={0.2} />
      </instancedMesh>
    </group>
  );
}
