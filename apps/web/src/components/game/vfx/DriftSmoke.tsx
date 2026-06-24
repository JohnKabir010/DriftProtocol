"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const MAX_PARTICLES = 60;

const VERT = /* glsl */ `
  attribute float aSize;
  attribute float aOpacity;
  varying float vOpacity;
  void main() {
    vOpacity = aOpacity;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (350.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  varying float vOpacity;
  uniform vec3 uColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = smoothstep(1.0, 0.0, d) * vOpacity;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; // 0→1 (born→dead)
  maxLife: number;
}

export function DriftSmoke({
  carPosition,
  carYaw,
  active,
}: {
  carPosition: THREE.Vector3;
  carYaw: number;
  active: boolean;
}) {
  const pointsRef = useRef<THREE.Points>(null);

  // Particle pool
  const pool = useRef<Particle[]>(Array.from({ length: MAX_PARTICLES }, () => ({
    x: 0, y: -999, z: 0,
    vx: 0, vy: 0, vz: 0,
    life: 1, maxLife: 1,
  })));
  const cursor = useRef(0);

  // Buffer attributes (mutated in-place, needsUpdate set each frame)
  const { positions, sizes, opacities, material } = useMemo(() => {
    const positions = new Float32Array(MAX_PARTICLES * 3);
    const sizes = new Float32Array(MAX_PARTICLES);
    const opacities = new Float32Array(MAX_PARTICLES);
    sizes.fill(0);
    opacities.fill(0);

    const material = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0.5, 0.55, 0.65) } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { positions, sizes, opacities, material };
  }, []);

  const spawnTimer = useRef(0);

  useFrame((_, dt) => {
    const pts = pointsRef.current;
    if (!pts) return;

    const geo = pts.geometry;
    const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
    const sizeAttr = geo.getAttribute("aSize") as THREE.BufferAttribute;
    const opAttr = geo.getAttribute("aOpacity") as THREE.BufferAttribute;

    // Spawn new particles while drifting (2 per frame at 30fps ≈ 60/s)
    spawnTimer.current += dt;
    if (active && spawnTimer.current > 0.04) {
      spawnTimer.current = 0;
      // Rear axle position (1.5m behind car)
      const rx = carPosition.x - Math.sin(carYaw) * 1.5;
      const rz = carPosition.z - Math.cos(carYaw) * 1.5;

      for (let s = 0; s < 2; s++) {
        const p = pool.current[cursor.current % MAX_PARTICLES]!;
        cursor.current++;
        p.x = rx + (Math.random() - 0.5) * 0.8;
        p.y = 0.15 + Math.random() * 0.1;
        p.z = rz + (Math.random() - 0.5) * 0.8;
        p.vx = (Math.random() - 0.5) * 1.5;
        p.vy = 0.5 + Math.random() * 1.0;
        p.vz = (Math.random() - 0.5) * 1.5;
        p.maxLife = 0.8 + Math.random() * 0.6;
        p.life = 0;
      }
    }

    // Update all particles
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = pool.current[i]!;
      if (p.life >= p.maxLife) {
        // Dead — park offscreen
        positions[i * 3 + 1] = -999;
        sizes[i] = 0;
        opacities[i] = 0;
        continue;
      }
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 0.4 * dt; // gentle gravity drag
      p.vx *= 0.97;
      p.vz *= 0.97;

      const t = p.life / p.maxLife; // 0→1
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      sizes[i] = 1.0 + t * 2.5; // grows as it rises
      opacities[i] = (1 - t) * 0.6;
    }

    posAttr.array.set(positions);
    sizeAttr.array.set(sizes);
    opAttr.array.set(opacities);
    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    opAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={MAX_PARTICLES} itemSize={3} />
        <bufferAttribute attach="attributes-aSize" array={sizes} count={MAX_PARTICLES} itemSize={1} />
        <bufferAttribute attach="attributes-aOpacity" array={opacities} count={MAX_PARTICLES} itemSize={1} />
      </bufferGeometry>
    </points>
  );
}
