"use client";

import { useEffect, useRef, useState } from "react";
import type { InputSnapshot } from "@/game/useInput";

interface Props {
  inputRef: React.MutableRefObject<InputSnapshot>;
}

const JOYSTICK_RADIUS = 52;
const KNOB_RADIUS = 22;

/**
 * Mobile touch overlay: left joystick for steering, right-side buttons for
 * throttle / brake / handbrake / nitro. Writes directly into the shared input
 * ref so there's zero React render per frame.
 */
export function TouchControls({ inputRef }: Props) {
  const [visible, setVisible] = useState(false);
  const joystickBase = useRef<HTMLDivElement>(null);
  const joystickKnob = useRef<HTMLDivElement>(null);
  const joystickTouchId = useRef<number | null>(null);
  const baseCenter = useRef({ x: 0, y: 0 });

  // Show only on touch devices.
  useEffect(() => {
    const check = () => setVisible(window.matchMedia("(pointer:coarse)").matches);
    check();
    window.matchMedia("(pointer:coarse)").addEventListener("change", check);
    return () => window.matchMedia("(pointer:coarse)").removeEventListener("change", check);
  }, []);

  // Joystick pointer handlers
  function onJoystickStart(e: React.PointerEvent) {
    if (joystickTouchId.current !== null) return;
    joystickTouchId.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rect = joystickBase.current!.getBoundingClientRect();
    baseCenter.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function onJoystickMove(e: React.PointerEvent) {
    if (e.pointerId !== joystickTouchId.current) return;
    const dx = e.clientX - baseCenter.current.x;
    const dy = e.clientY - baseCenter.current.y;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), JOYSTICK_RADIUS);
    const angle = Math.atan2(dy, dx);
    const knobX = Math.cos(angle) * dist;
    const knobY = Math.sin(angle) * dist;

    const knob = joystickKnob.current;
    if (knob) {
      knob.style.transform = `translate(${knobX}px, ${knobY}px)`;
    }
    // Horizontal component → steer (-1 to 1)
    inputRef.current.steer = Math.max(-1, Math.min(1, dx / JOYSTICK_RADIUS));
  }

  function onJoystickEnd(e: React.PointerEvent) {
    if (e.pointerId !== joystickTouchId.current) return;
    joystickTouchId.current = null;
    if (joystickKnob.current) joystickKnob.current.style.transform = "translate(0,0)";
    inputRef.current.steer = 0;
  }

  function makeButtonHandlers(field: "throttle" | "brake" | "handbrake" | "nitro", bool = false) {
    const on = bool ? true : 1;
    const off = bool ? false : 0;
    return {
      onPointerDown: (e: React.PointerEvent) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        (inputRef.current as any)[field] = on;
      },
      onPointerUp: () => { (inputRef.current as any)[field] = off; },
      onPointerCancel: () => { (inputRef.current as any)[field] = off; },
    };
  }

  if (!visible) return null;

  return (
    <div className="absolute inset-0 pointer-events-none select-none" style={{ zIndex: 20 }}>
      {/* Left: steering joystick */}
      <div
        className="absolute bottom-12 left-8 pointer-events-auto"
        style={{ width: JOYSTICK_RADIUS * 2, height: JOYSTICK_RADIUS * 2 }}
        onPointerDown={onJoystickStart}
        onPointerMove={onJoystickMove}
        onPointerUp={onJoystickEnd}
        onPointerCancel={onJoystickEnd}
      >
        {/* Base ring */}
        <div
          ref={joystickBase}
          className="absolute inset-0 rounded-full border-2 border-neon-cyan/30 bg-black/30 backdrop-blur-sm"
        />
        {/* Knob */}
        <div
          ref={joystickKnob}
          className="absolute rounded-full bg-neon-cyan/70 border border-neon-cyan"
          style={{
            width: KNOB_RADIUS * 2,
            height: KNOB_RADIUS * 2,
            top: JOYSTICK_RADIUS - KNOB_RADIUS,
            left: JOYSTICK_RADIUS - KNOB_RADIUS,
            transition: "transform 0.05s",
          }}
        />
      </div>

      {/* Right: action buttons */}
      <div className="absolute bottom-12 right-8 flex flex-col gap-3 pointer-events-auto">
        <button
          {...makeButtonHandlers("nitro", true)}
          className="w-16 h-16 rounded-full bg-neon-volt/20 border-2 border-neon-volt/60 font-display text-xs text-neon-volt active:bg-neon-volt/50 touch-none"
        >
          BOOST
        </button>
        <button
          {...makeButtonHandlers("handbrake", true)}
          className="w-16 h-16 rounded-full bg-neon-magenta/20 border-2 border-neon-magenta/60 font-display text-xs text-neon-magenta active:bg-neon-magenta/50 touch-none"
        >
          DRIFT
        </button>
      </div>

      {/* Bottom center: throttle + brake */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-6 pointer-events-auto">
        <button
          {...makeButtonHandlers("brake")}
          className="w-20 h-14 rounded bg-white/10 border border-white/20 font-display text-xs text-white/60 active:bg-white/30 touch-none"
        >
          BRAKE
        </button>
        <button
          {...makeButtonHandlers("throttle")}
          className="w-20 h-14 rounded bg-neon-cyan/10 border-2 border-neon-cyan/40 font-display text-xs text-neon-cyan active:bg-neon-cyan/30 touch-none"
        >
          GAS
        </button>
      </div>
    </div>
  );
}
