"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";

const offset = new Vector3();
const target = new Vector3();

/** Smooth chase camera: lags behind the car, looks slightly ahead of it. */
export function ChaseCamera() {
  const scene = useThree((s) => s.scene);

  useFrame(({ camera }, dt) => {
    const car = scene.getObjectByName("player-car");
    if (!car) return;

    offset.set(0, 3.2, -7.5).applyQuaternion(car.quaternion).add(car.position);
    camera.position.lerp(offset, 1 - Math.exp(-6 * dt));

    target.set(0, 1, 6).applyQuaternion(car.quaternion).add(car.position);
    camera.lookAt(target);
  });

  return null;
}
