"use client";

import { useRef, useMemo, useLayoutEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ─── Counts ────────────────────────────────────────────────────────────────────
const TALL_COUNT    = 60;
const MID_COUNT     = 90;
const SLAB_COUNT    = 30;  // wide flat slabs for skyline variety
const NEEDLE_COUNT  = 20;  // super-slim needles/spires
const FAR_COUNT     = 52;
const ROOFTOP_COUNT = 24;
const AC_COUNT      = 80;  // rooftop AC/HVAC boxes
const TRAFFIC_COUNT = 32;
const SIGN_COUNT    = 28;  // wall neon signs on mid-rise facades
const BILLBOARD_COUNT = 14;

// ─── Deterministic seeded PRNG ─────────────────────────────────────────────────
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Window shader — animated HDR neon windows + edge accent ───────────────────
const windowVertexShader = /* glsl */ `
varying vec2 vUv;
varying float vHeight;
void main() {
  vUv = uv;
  vHeight = position.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const windowFragmentShader = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying float vHeight;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 grid = vec2(4.0, 12.0);
  vec2 cell = floor(vUv * grid);
  vec2 cellUv = fract(vUv * grid);

  float winMask = step(0.10, cellUv.x) * step(0.10, cellUv.y) *
                  step(cellUv.x, 0.90) * step(cellUv.y, 0.90);

  float r = hash(cell);
  float flicker = step(0.78, r) * (0.5 + 0.5 * sin(uTime * (2.5 + r * 10.0) + r * 6.28));
  float baseOn  = step(0.38, r) * (1.0 - step(0.78, r));
  float lit = max(baseOn, flicker);

  float colorChoice = hash(cell + vec2(5.3, 2.7));
  vec3 winCyan    = vec3(0.0,  0.92, 1.0)  * 2.0;
  vec3 winMagenta = vec3(1.0,  0.15, 0.58) * 2.0;
  vec3 winAmber   = vec3(1.0,  0.55, 0.08) * 1.6;
  vec3 winGreen   = vec3(0.12, 1.0,  0.44) * 1.7;
  vec3 winColor;
  if      (colorChoice < 0.42) winColor = winCyan;
  else if (colorChoice < 0.72) winColor = winMagenta;
  else if (colorChoice < 0.88) winColor = winAmber;
  else                         winColor = winGreen;

  // Building facade: near-black with subtle panel lines
  vec3 base = vec3(0.018, 0.026, 0.048);
  // Subtle horizontal panel bands
  float panel = step(0.96, fract(vUv.y * 16.0)) * 0.04;
  base += panel;
  // Edge accent glow (very dim corner trim)
  float edgeX = 1.0 - smoothstep(0.0, 0.015, vUv.x) * smoothstep(0.0, 0.015, 1.0 - vUv.x);
  float edgeY = 1.0 - smoothstep(0.0, 0.015, vUv.y) * smoothstep(0.0, 0.015, 1.0 - vUv.y);
  base += max(edgeX, edgeY) * vec3(0.0, 0.04, 0.08);

  vec3 color = mix(base, winColor, winMask * lit);
  gl_FragColor = vec4(color, 1.0);
}
`;

// ─── Holographic megascreen — glitch, scanlines, scroll ──────────────────────
const holoFragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
varying vec2 vUv;

float hash(float n) { return fract(sin(n) * 43758.5453); }

void main() {
  vec2 uv = vUv;
  float slice = floor(uv.y * 24.0);
  float g = hash(slice + floor(uTime * 7.0));
  if (g > 0.93) uv.x = fract(uv.x + (g - 0.93) * 5.0);

  float band   = 0.55 + 0.45 * step(0.5, fract(uv.y * 3.0 - uTime * 0.4));
  float scan   = 0.80 + 0.20 * step(0.5, fract(uv.y * 100.0));
  float flick  = 0.88 + 0.12 * sin(uTime * 42.0 + uv.y * 12.0);
  float border = step(0.025, uv.x) * step(uv.x, 0.975) * step(0.03, uv.y) * step(uv.y, 0.97);

  vec3 color = uColor * band * scan * flick * (0.3 + 0.7 * border) * 2.8;
  gl_FragColor = vec4(color, 0.92);
}
`;

// ─── Neon sign shader — buzzing flat sign ─────────────────────────────────────
const signFragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
varying vec2 vUv;

void main() {
  float buzz = 0.92 + 0.08 * sin(uTime * 58.0);
  float border = step(0.04, vUv.x) * step(vUv.x, 0.96) *
                 step(0.10, vUv.y) * step(vUv.y, 0.90);
  // Horizontal stripe text stand-in
  float stripe = step(0.3, fract(vUv.y * 3.0)) * step(fract(vUv.y * 3.0), 0.7);
  float mask = max(border * 0.6, stripe * border);
  vec3 color = uColor * buzz * 3.5 * mask;
  gl_FragColor = vec4(color, mask * 0.85);
}
`;

/** Organic sector-ring placement: buildings cluster around points, not a perfect circle. */
function buildSectorLayout(
  rng: () => number,
  cx: number,
  cz: number,
  count: number,
  minR: number,
  maxR: number,
  sectorCount = 8,
): Array<{ x: number; z: number; r: number; angle: number }> {
  const result: Array<{ x: number; z: number; r: number; angle: number }> = [];
  for (let i = 0; i < count; i++) {
    // Pick a random sector, bias toward filling it
    const sector = Math.floor(rng() * sectorCount);
    const sectorAngle = (sector / sectorCount) * Math.PI * 2;
    const angleSpread = (Math.PI * 2) / sectorCount;
    const angle = sectorAngle + (rng() - 0.5) * angleSpread * 1.4;
    const radius = minR + rng() * (maxR - minR);
    // Add lateral jitter to break the ring
    const jitter = (rng() - 0.5) * (maxR - minR) * 0.35;
    const nx = Math.cos(angle + Math.PI / 2);
    const nz = Math.sin(angle + Math.PI / 2);
    result.push({
      x: cx + Math.cos(angle) * radius + nx * jitter,
      z: cz + Math.sin(angle) * radius + nz * jitter,
      r: rng(),
      angle,
    });
  }
  return result;
}

/**
 * Living cyberpunk skyline — four depth rings, organic clustering, animated life:
 * near mid-rises → neon-window towers → slim needles → far silhouettes. On top:
 * glitching holographic megascreens, rotating searchlights, hover traffic
 * streams, pulsing rooftop beacons, AC units, wall neon signs, and additive
 * haze planes that give the skyline 3D depth. Everything instanced or a handful
 * of meshes. Rooftop AC/HVAC and antenna clusters layer fine surface detail
 * without extra draw calls.
 */
export function CityBlocks({ cx = 45, cz = 100 }: { cx?: number; cz?: number }) {
  const tallMeshRef   = useRef<THREE.InstancedMesh>(null);
  const midMeshRef    = useRef<THREE.InstancedMesh>(null);
  const slabMeshRef   = useRef<THREE.InstancedMesh>(null);
  const needleMeshRef = useRef<THREE.InstancedMesh>(null);
  const farMeshRef    = useRef<THREE.InstancedMesh>(null);
  const rooftopRef    = useRef<THREE.InstancedMesh>(null);
  const rooftopMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const acRef         = useRef<THREE.InstancedMesh>(null);
  const trafficRef    = useRef<THREE.InstancedMesh>(null);
  const searchRef     = useRef<THREE.Group>(null);
  const matRef        = useRef<THREE.ShaderMaterial>(null);
  const holoMats      = useRef<THREE.ShaderMaterial[]>([]);
  const signMats      = useRef<THREE.ShaderMaterial[]>([]);

  // ── Tall towers ─────────────────────────────────────────────────────────────
  const tallTransforms = useMemo(() => {
    const rng = mulberry32(0x9e3779b9 ^ (cx * 1000 + cz) | 0);
    const dummy = new THREE.Object3D();
    return buildSectorLayout(rng, cx, cz, TALL_COUNT, 145, 280, 10).map((p) => {
      const w = 10 + rng() * 16;
      const d = 10 + rng() * 13;
      const h = 35 + rng() * 90;
      dummy.position.set(p.x, h / 2, p.z);
      dummy.scale.set(w, h, d);
      dummy.rotation.set(0, rng() * Math.PI * 0.5, 0);
      dummy.updateMatrix();
      return { matrix: dummy.matrix.clone(), topY: h, x: p.x, z: p.z };
    });
  }, [cx, cz]);

  // ── Mid-rise foreground ──────────────────────────────────────────────────────
  const midTransforms = useMemo(() => {
    const rng = mulberry32(0xdeadbeef ^ (cx * 999 + cz) | 0);
    const dummy = new THREE.Object3D();
    return buildSectorLayout(rng, cx, cz, MID_COUNT, 125, 175, 12).map((p) => {
      const w = 7 + rng() * 11;
      const d = 6 + rng() * 9;
      const h = 9 + rng() * 28;
      dummy.position.set(p.x, h / 2, p.z);
      dummy.scale.set(w, h, d);
      dummy.rotation.set(0, rng() * Math.PI * 0.5, 0);
      dummy.updateMatrix();
      return dummy.matrix.clone();
    });
  }, [cx, cz]);

  // ── Wide slabs — adds skyline depth variation ────────────────────────────────
  const slabTransforms = useMemo(() => {
    const rng = mulberry32(0xcafebabe ^ (cx * 997 + cz) | 0);
    const dummy = new THREE.Object3D();
    return buildSectorLayout(rng, cx, cz, SLAB_COUNT, 160, 250, 8).map((p) => {
      const w = 25 + rng() * 35;
      const d = 10 + rng() * 14;
      const h = 15 + rng() * 40;
      dummy.position.set(p.x, h / 2, p.z);
      dummy.scale.set(w, h, d);
      dummy.rotation.set(0, p.angle + rng() * 0.4, 0);
      dummy.updateMatrix();
      return dummy.matrix.clone();
    });
  }, [cx, cz]);

  // ── Slim needles / spires ────────────────────────────────────────────────────
  const needleTransforms = useMemo(() => {
    const rng = mulberry32(0xfeedface ^ (cx * 1001 + cz) | 0);
    const dummy = new THREE.Object3D();
    return buildSectorLayout(rng, cx, cz, NEEDLE_COUNT, 140, 220, 6).map((p) => {
      const w = 2 + rng() * 3;
      const h = 60 + rng() * 120;
      dummy.position.set(p.x, h / 2, p.z);
      dummy.scale.set(w, h, w);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      return dummy.matrix.clone();
    });
  }, [cx, cz]);

  // ── Far silhouette ring ──────────────────────────────────────────────────────
  const farTransforms = useMemo(() => {
    const rng = mulberry32(0xbadf00d ^ (cx * 1003 + cz) | 0);
    const dummy = new THREE.Object3D();
    return Array.from({ length: FAR_COUNT }, (_, i) => {
      const angle = (i / FAR_COUNT) * Math.PI * 2 + (rng() - 0.5) * 0.22;
      const radius = 340 + rng() * 180;
      const w = 35 + rng() * 60;
      const h = 70 + rng() * 160;
      dummy.position.set(cx + Math.cos(angle) * radius, h / 2, cz + Math.sin(angle) * radius);
      dummy.scale.set(w, h, w * (0.55 + rng() * 0.65));
      dummy.updateMatrix();
      return dummy.matrix.clone();
    });
  }, [cx, cz]);

  // ── Rooftop aviation beacons ─────────────────────────────────────────────────
  const rooftopTransforms = useMemo(() => {
    const dummy = new THREE.Object3D();
    return tallTransforms.slice(0, ROOFTOP_COUNT).map(({ topY, x, z }) => {
      dummy.position.set(x, topY + 0.6, z);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      return dummy.matrix.clone();
    });
  }, [tallTransforms]);

  // ── Rooftop AC / HVAC units ──────────────────────────────────────────────────
  const acTransforms = useMemo(() => {
    const rng = mulberry32(0x12345678 ^ (cx * 1007 + cz) | 0);
    const dummy = new THREE.Object3D();
    const matrices: THREE.Matrix4[] = [];
    // Place 2-4 AC units on the larger tall tower rooftops
    for (const { topY, x, z } of tallTransforms.slice(0, AC_COUNT / 3)) {
      const count = 2 + Math.floor(rng() * 3);
      for (let k = 0; k < count; k++) {
        const ox = (rng() - 0.5) * 8;
        const oz = (rng() - 0.5) * 8;
        const sw = 1.2 + rng() * 1.8;
        const sh = 0.6 + rng() * 1.0;
        dummy.position.set(x + ox, topY + sh / 2, z + oz);
        dummy.scale.set(sw, sh, sw * (0.6 + rng() * 0.5));
        dummy.rotation.set(0, rng() * Math.PI, 0);
        dummy.updateMatrix();
        matrices.push(dummy.matrix.clone());
        if (matrices.length >= AC_COUNT) break;
      }
      if (matrices.length >= AC_COUNT) break;
    }
    return matrices;
  }, [tallTransforms, cx, cz]);

  // ── Hover traffic lanes ──────────────────────────────────────────────────────
  const traffic = useMemo(() => {
    const rng = mulberry32(0xabcdef12 ^ (cx * 1009 + cz) | 0);
    return Array.from({ length: TRAFFIC_COUNT }, (_, i) => ({
      radius: 155 + (i % 6) * 36 + rng() * 12,
      height:  28 + (i % 7) *  8 + rng() * 5,
      speed:  (0.04 + rng() * 0.07) * (i % 2 === 0 ? 1 : -1),
      phase:   rng() * Math.PI * 2,
      white:   i % 3 !== 0,
    }));
  }, [cx, cz]);

  // ── Holographic megascreens ──────────────────────────────────────────────────
  const billboards = useMemo(() => {
    const rng = mulberry32(0x87654321 ^ (cx * 1011 + cz) | 0);
    const colors = ["#00f0ff", "#ff2e97", "#ccff00", "#7b2fff", "#ff6b00", "#00ff88", "#ff0044"];
    return Array.from({ length: BILLBOARD_COUNT }, (_, i) => {
      const angle  = (i / BILLBOARD_COUNT) * Math.PI * 2 + 0.25;
      const radius = 138 + rng() * 14;
      const x = cx + Math.cos(angle) * radius;
      const z = cz + Math.sin(angle) * radius;
      const y = 8 + rng() * 22;
      // Mix of wide-landscape and tall-portrait screens
      const landscape = rng() > 0.35;
      const w = landscape ? 14 + rng() * 10 : 5 + rng() * 4;
      const h = landscape ?  5 + rng() * 3  : 10 + rng() * 7;
      const color = colors[i % colors.length]!;
      const yaw = Math.atan2(cx - x, cz - z);
      return { x, y, z, w, h, color, yaw };
    });
  }, [cx, cz]);

  // ── Wall neon signs on mid-rises ─────────────────────────────────────────────
  const signs = useMemo(() => {
    const rng = mulberry32(0x11223344 ^ (cx * 1013 + cz) | 0);
    const colors = ["#ff2e97", "#00f0ff", "#ccff00", "#ff6b00", "#7b2fff", "#ff0044", "#00ff88"];
    const result = [];
    for (let i = 0; i < SIGN_COUNT; i++) {
      const angle  = (i / SIGN_COUNT) * Math.PI * 2 + rng() * 0.5;
      const radius = 130 + rng() * 20;
      const x = cx + Math.cos(angle) * radius;
      const z = cz + Math.sin(angle) * radius;
      const y = 5 + rng() * 14;
      const w = 4 + rng() * 6;
      const h = 1.5 + rng() * 2.5;
      const color = colors[i % colors.length]!;
      const yaw = Math.atan2(cx - x, cz - z) + (rng() - 0.5) * 0.4;
      result.push({ x, y, z, w, h, color, yaw });
    }
    return result;
  }, [cx, cz]);

  // ── Searchlight bases ────────────────────────────────────────────────────────
  const searchlights = useMemo(
    () =>
      tallTransforms
        .slice(0, 6)
        .map((t, i) => ({ x: t.x, y: t.topY, z: t.z, tilt: 0.28 + i * 0.08, rate: 0.10 + i * 0.06 })),
    [tallTransforms],
  );

  // ── Apply instance matrices ──────────────────────────────────────────────────
  useLayoutEffect(() => {
    const apply = (m: THREE.InstancedMesh | null, list: THREE.Matrix4[]) => {
      if (!m) return;
      list.forEach((matrix, i) => m.setMatrixAt(i, matrix));
      m.instanceMatrix.needsUpdate = true;
    };
    apply(tallMeshRef.current,   tallTransforms.map((t) => t.matrix));
    apply(midMeshRef.current,    midTransforms);
    apply(slabMeshRef.current,   slabTransforms);
    apply(needleMeshRef.current, needleTransforms);
    apply(farMeshRef.current,    farTransforms);
    apply(rooftopRef.current,    rooftopTransforms);
    apply(acRef.current,         acTransforms);
  }, [tallTransforms, midTransforms, slabTransforms, needleTransforms, farTransforms, rooftopTransforms, acTransforms]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // ── Frame animation ──────────────────────────────────────────────────────────
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (matRef.current?.uniforms.uTime) matRef.current.uniforms.uTime.value += delta;
    for (const m of holoMats.current) if (m?.uniforms.uTime) m.uniforms.uTime.value = t;
    for (const m of signMats.current)  if (m?.uniforms.uTime) m.uniforms.uTime.value = t;

    if (rooftopMatRef.current) {
      rooftopMatRef.current.emissiveIntensity = 2.8 + 2.4 * Math.max(0, Math.sin(t * 2.2));
    }

    if (searchRef.current) {
      searchRef.current.children.forEach((child, i) => {
        const cfg = searchlights[i];
        if (cfg) child.rotation.y = t * cfg.rate * Math.PI * 2;
      });
    }

    const tm = trafficRef.current;
    if (tm) {
      traffic.forEach((v, i) => {
        const a = v.phase + t * v.speed;
        dummy.position.set(cx + Math.cos(a) * v.radius, v.height, cz + Math.sin(a) * v.radius);
        dummy.rotation.set(0, -a, 0);
        dummy.scale.set(2.8, 0.32, 0.55);
        dummy.updateMatrix();
        tm.setMatrixAt(i, dummy.matrix);
      });
      tm.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Tall neon-window towers */}
      <instancedMesh ref={tallMeshRef} args={[undefined, undefined, TALL_COUNT]} frustumCulled={false}>
        <boxGeometry />
        <shaderMaterial
          ref={matRef}
          vertexShader={windowVertexShader}
          fragmentShader={windowFragmentShader}
          uniforms={{ uTime: { value: 0 } }}
        />
      </instancedMesh>

      {/* Mid-rise foreground — dark, grounded, catches neon spill */}
      <instancedMesh ref={midMeshRef} args={[undefined, undefined, MID_COUNT]}>
        <boxGeometry />
        <meshStandardMaterial color="#040710" emissive="#06101e" emissiveIntensity={0.3} roughness={0.88} metalness={0.3} />
      </instancedMesh>

      {/* Wide horizontal slabs */}
      <instancedMesh ref={slabMeshRef} args={[undefined, undefined, SLAB_COUNT]}>
        <boxGeometry />
        <meshStandardMaterial color="#03050b" emissive="#050d18" emissiveIntensity={0.25} roughness={0.9} metalness={0.35} />
      </instancedMesh>

      {/* Slim needles / spires */}
      <instancedMesh ref={needleMeshRef} args={[undefined, undefined, NEEDLE_COUNT]}>
        <boxGeometry />
        <meshStandardMaterial color="#060a14" emissive="#00d0ff" emissiveIntensity={0.12} roughness={0.6} metalness={0.7} />
      </instancedMesh>

      {/* Far megablock silhouettes */}
      <instancedMesh ref={farMeshRef} args={[undefined, undefined, FAR_COUNT]} frustumCulled={false}>
        <boxGeometry />
        <meshStandardMaterial color="#030507" roughness={1} />
      </instancedMesh>

      {/* Rooftop aviation beacons */}
      <instancedMesh ref={rooftopRef} args={[undefined, undefined, ROOFTOP_COUNT]}>
        <sphereGeometry args={[0.55, 4, 4]} />
        <meshStandardMaterial ref={rooftopMatRef} color="#ff2e97" emissive="#ff2e97" emissiveIntensity={4.5} roughness={0.4} />
      </instancedMesh>

      {/* Rooftop AC/HVAC boxes */}
      <instancedMesh ref={acRef} args={[undefined, undefined, acTransforms.length]}>
        <boxGeometry />
        <meshStandardMaterial color="#0a0e16" roughness={0.8} metalness={0.6} emissive="#001428" emissiveIntensity={0.4} />
      </instancedMesh>

      {/* Hover traffic streams */}
      <instancedMesh ref={trafficRef} args={[undefined, undefined, TRAFFIC_COUNT]}>
        <boxGeometry />
        <meshStandardMaterial color="#ffffff" emissive="#c8e0ff" emissiveIntensity={6} toneMapped />
      </instancedMesh>

      {/* Holographic megascreens */}
      {billboards.map((b, i) => (
        <mesh key={i} position={[b.x, b.y, b.z]} rotation={[0, b.yaw, 0]}>
          <planeGeometry args={[b.w, b.h]} />
          <shaderMaterial
            ref={(m) => { if (m) holoMats.current[i] = m; }}
            vertexShader={windowVertexShader}
            fragmentShader={holoFragmentShader}
            uniforms={{ uTime: { value: 0 }, uColor: { value: new THREE.Color(b.color) } }}
            transparent
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Wall neon signs */}
      {signs.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, s.z]} rotation={[0, s.yaw, 0]}>
          <planeGeometry args={[s.w, s.h]} />
          <shaderMaterial
            ref={(m) => { if (m) signMats.current[i] = m; }}
            vertexShader={windowVertexShader}
            fragmentShader={signFragmentShader}
            uniforms={{ uTime: { value: 0 }, uColor: { value: new THREE.Color(s.color) } }}
            transparent
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}

      {/* Rotating searchlight shafts */}
      <group ref={searchRef}>
        {searchlights.map((s, i) => (
          <group key={i} position={[s.x, s.y, s.z]}>
            <mesh position={[0, 100, 36]} rotation={[s.tilt, 0, 0]}>
              <coneGeometry args={[12, 220, 18, 1, true]} />
              <meshBasicMaterial
                color="#9fd8ff"
                transparent
                opacity={0.038}
                blending={THREE.AdditiveBlending}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* Atmospheric haze planes — layered depth without colour wash */}
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2 + 0.55;
        const dist = 280 + i * 20;
        return (
          <mesh
            key={i}
            position={[cx + Math.cos(a) * dist, 44, cz + Math.sin(a) * dist]}
            rotation={[0, Math.atan2(cx - (cx + Math.cos(a) * dist), cz - (cz + Math.sin(a) * dist)), 0]}
          >
            <planeGeometry args={[580, 130]} />
            <meshBasicMaterial
              color="#081e38"
              transparent
              opacity={0.042}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        );
      })}

      {/* Low ground-level light pollution haze */}
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + 1.2;
        return (
          <mesh
            key={i}
            position={[cx + Math.cos(a) * 160, 2, cz + Math.sin(a) * 160]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[200, 200]} />
            <meshBasicMaterial
              color="#050f20"
              transparent
              opacity={0.06}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
