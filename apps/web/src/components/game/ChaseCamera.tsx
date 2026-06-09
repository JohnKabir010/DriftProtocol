"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, Vector3 } from "three";
import { useRaceStore } from "@/stores/raceStore";

const offset = new Vector3();
const target = new Vector3();

const BASE_FOV = 60;
const SPEED_FOV = 14; // extra FOV at top speed
const NITRO_FOV = 8; // extra kick while boosting

/**
 * Chase camera: lags behind the car, looks ahead of it, and widens FOV with
 * speed (+nitro) for the sense of velocity — the cheapest speed VFX there is.
 */
export function ChaseCamera() {
  const scene = useThree((s) => s.scene);

  useFrame(({ camera }, dt) => {
    const car = scene.getObjectByName("player-car");
    if (!car) return;

    offset.set(0, 3.2, -7.5).applyQuaternion(car.quaternion).add(car.position);
    camera.position.lerp(offset, 1 - Math.exp(-6 * dt));

    target.set(0, 1, 8).applyQuaternion(car.quaternion).add(car.position);
    camera.lookAt(target);

    const { speedKmh, boosting } = useRaceStore.getState();
    const speedNorm = Math.min(speedKmh / 250, 1);
    const targetFov = BASE_FOV + SPEED_FOV * speedNorm + (boosting ? NITRO_FOV : 0);
    const cam = camera as PerspectiveCamera;
    cam.fov += (targetFov - cam.fov) * (1 - Math.exp(-4 * dt));
    cam.updateProjectionMatrix();
  });

  return null;
}
