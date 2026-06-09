"use client";

import { create } from "zustand";
import type { RacePhase } from "@drift/shared";

interface Telemetry {
  speedKmh: number;
}

interface RaceStore {
  phase: RacePhase;
  telemetry: Telemetry;
  nitroBottles: number;
  driftChain: number;
  setPhase: (phase: RacePhase) => void;
  setTelemetry: (t: Partial<Telemetry>) => void;
}

/** Transient race-session state; HUD subscribes here, the canvas writes here. */
export const useRaceStore = create<RaceStore>((set) => ({
  phase: "WAITING",
  telemetry: { speedKmh: 0 },
  nitroBottles: 3,
  driftChain: 0,
  setPhase: (phase) => set({ phase }),
  setTelemetry: (t) => set((s) => ({ telemetry: { ...s.telemetry, ...t } })),
}));
