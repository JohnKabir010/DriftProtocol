import * as THREE from "three";

/**
 * AAA-style multilayer wet asphalt: a MeshStandardMaterial with injected
 * shader stages, so it keeps the full PBR pipeline (env reflections, lights,
 * shadows, tonemapping) and layers on top of it:
 *
 *  - micro roughness breakup     (high-freq value noise — kills the "plastic" look)
 *  - puddle accumulation mask    (low-freq noise → near-mirror roughness 0.04)
 *  - animated rain ripples       (puddle-local normal perturbation)
 *  - twin tire-wear bands        (darkened, polished racing lines via ribbon UV.v)
 *  - sparse crack network        (thresholded noise, darkened albedo)
 *  - edge erosion                (rougher, broken-up shading at the road border)
 *
 * Reflections come from the scene env map sharpened inside puddles by the
 * roughness mask — physically grounded, no mirror-everywhere fakery.
 */
export function createWetAsphaltMaterial(baseColor: string): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: 0.5,
    metalness: 0.86,
    envMapIntensity: 2.4,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    mat.userData.shader = shader;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec2 vRoadUv;
varying vec3 vRoadWorld;`,
      )
      .replace(
        "#include <uv_vertex>",
        `#include <uv_vertex>
vRoadUv = uv;
vRoadWorld = (modelMatrix * vec4(position, 1.0)).xyz;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec2 vRoadUv;
varying vec3 vRoadWorld;
uniform float uTime;
float wa_hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float wa_noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wa_hash(i), wa_hash(i + vec2(1, 0)), f.x),
             mix(wa_hash(i + vec2(0, 1)), wa_hash(i + vec2(1, 1)), f.x), f.y);
}
float wa_puddle(vec2 w) { return smoothstep(0.60, 0.74, wa_noise(w * 0.16)); }
float wa_wear(float v)  { float d = abs(v - 0.5); return exp(-pow((d - 0.22) * 9.0, 2.0)); }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
{
  float micro  = wa_noise(vRoadWorld.xz * 7.0);
  float puddle = wa_puddle(vRoadWorld.xz);
  float wear   = wa_wear(vRoadUv.y);
  float crack  = step(0.986, wa_noise(vRoadWorld.xz * 2.4));
  // Neon color bleeding in puddles — deep cyan/magenta reflections
  float puddleN1 = wa_puddle(vRoadWorld.xz + vec2(8.3, 5.1));
  float puddleN2 = wa_puddle(vRoadWorld.xz + vec2(-6.7, 9.2));
  vec3  neonCyan  = vec3(0.0, 0.4, 0.6) * puddleN1 * 0.35;
  vec3  neonPink  = vec3(0.5, 0.0, 0.3) * puddleN2 * 0.25;
  diffuseColor.rgb *= (0.80 + micro * 0.38);                                 // aggregate breakup
  diffuseColor.rgb *= mix(1.0, 0.52, wear * 0.58);                           // rubbered-in lines
  diffuseColor.rgb  = mix(diffuseColor.rgb, diffuseColor.rgb * 0.28, puddle); // wet = darker
  diffuseColor.rgb += neonCyan + neonPink;                                    // neon bleed
  diffuseColor.rgb  = mix(diffuseColor.rgb, vec3(0.012), crack * 0.7);        // cracks
}`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
{
  float micro  = wa_noise(vRoadWorld.xz * 7.0);
  float puddle = wa_puddle(vRoadWorld.xz);
  float wear   = wa_wear(vRoadUv.y);
  float edge   = smoothstep(0.0, 0.07, vRoadUv.y) * smoothstep(1.0, 0.93, vRoadUv.y);
  roughnessFactor = 0.42 + micro * 0.3;                 // damp asphalt with breakup
  roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.72, wear * 0.6); // polished lines
  roughnessFactor = mix(roughnessFactor, 0.04, puddle); // puddles: near-mirror
  roughnessFactor = mix(0.92, roughnessFactor, edge);   // eroded, dry-rough edges
}`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
{
  float puddle = wa_puddle(vRoadWorld.xz);
  if (puddle > 0.01) {
    float r1 = sin(dot(vRoadWorld.xz, vec2(8.0, 11.0)) + uTime * 4.6);
    float r2 = sin(dot(vRoadWorld.xz, vec2(-12.0, 7.0)) + uTime * 3.3);
    normal = normalize(normal + vec3(r1, 0.0, r2) * 0.035 * puddle); // rain ripples
  }
}`,
      );
  };

  return mat;
}
