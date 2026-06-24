"use client";

import { useEffect, useRef } from "react";
import { useRaceStore } from "@/stores/raceStore";

/** DOM overlay: radial speed-line vignette + nitro flash. Pure CSS — zero Three.js cost. */
export function SpeedOverlay() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const prevBoostRef = useRef(false);

  useEffect(() => {
    let raf: number;

    function tick() {
      const { speedKmh, boosting, phase } = useRaceStore.getState();
      const el = overlayRef.current;
      const flash = flashRef.current;
      if (!el || !flash) { raf = requestAnimationFrame(tick); return; }

      if (phase !== "RACING") {
        el.style.opacity = "0";
        raf = requestAnimationFrame(tick);
        return;
      }

      // Speed lines: visible above 80 km/h, max at 200
      const intensity = Math.max(0, Math.min(1, (speedKmh - 80) / 120));
      el.style.opacity = String(intensity);

      // Nitro flash: one-shot on rising edge
      if (boosting && !prevBoostRef.current) {
        flash.style.opacity = "0.55";
        flash.style.transition = "opacity 0.05s ease-out";
        requestAnimationFrame(() => {
          if (flash) {
            flash.style.opacity = "0";
            flash.style.transition = "opacity 0.45s ease-out";
          }
        });
      }
      prevBoostRef.current = boosting;

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      {/* Radial speed lines — CSS conic-gradient rays */}
      <div
        ref={overlayRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0,
          background: `
            repeating-conic-gradient(
              from 0deg at 50% 50%,
              transparent 0deg,
              rgba(0,240,255,0.04) 1.5deg,
              transparent 3deg
            )
          `,
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 40%, black 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 40%, black 100%)",
        }}
      />
      {/* Corner vignette that deepens with speed */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 90% 85% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      {/* Nitro flash */}
      <div
        ref={flashRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0,
          background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(0,240,255,0.6), rgba(200,0,255,0.3), transparent 70%)",
          transition: "opacity 0.45s ease-out",
        }}
      />
    </>
  );
}
