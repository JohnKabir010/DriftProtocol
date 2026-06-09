"use client";

import { useEffect, useRef, type MutableRefObject } from "react";

export interface InputSnapshot {
  steer: number; // [-1, 1]
  throttle: number; // [0, 1]
  brake: number; // [0, 1]
  handbrake: boolean;
  nitro: boolean;
}

/**
 * Keyboard input (WASD/arrows, Space = handbrake, Shift = nitro) exposed as a
 * mutable ref so the render loop reads it without re-renders. Gamepad and
 * touch backends plug into the same snapshot shape later.
 */
export function useInput(): MutableRefObject<InputSnapshot> {
  const state = useRef<InputSnapshot>({ steer: 0, throttle: 0, brake: 0, handbrake: false, nitro: false });
  const keys = useRef(new Set<string>());

  useEffect(() => {
    const update = () => {
      const k = keys.current;
      const s = state.current;
      s.throttle = k.has("KeyW") || k.has("ArrowUp") ? 1 : 0;
      s.brake = k.has("KeyS") || k.has("ArrowDown") ? 1 : 0;
      s.steer = (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0) - (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0);
      s.handbrake = k.has("Space");
      s.nitro = k.has("ShiftLeft") || k.has("ShiftRight");
    };
    const down = (e: KeyboardEvent) => {
      keys.current.add(e.code);
      update();
    };
    const up = (e: KeyboardEvent) => {
      keys.current.delete(e.code);
      update();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  return state;
}
