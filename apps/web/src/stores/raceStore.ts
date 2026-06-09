"use client";

import { create } from "zustand";
import type { RacePhase } from "@drift/shared";

export interface RaceResultRow {
  handle: string;
  position: number;
  finishTimeMs: number | null;
  driftScore: number;
  isLocal: boolean;
}

interface RaceStore {
  phase: RacePhase;
  countdownEndsAt: number | null;
  // Telemetry (written by the sim loop at ~10Hz, read by the HUD)
  speedKmh: number;
  boosting: boolean;
  nitroBottles: number;
  nitroCharge: number;
  driftChain: number;
  driftScore: number;
  lap: number; // 1-based for display
  totalLaps: number;
  raceTimeMs: number;
  results: RaceResultRow[] | null;
  patch: (partial: Partial<Omit<RaceStore, "patch" | "reset">>) => void;
  reset: () => void;
}

const initial = {
  phase: "WAITING" as RacePhase,
  countdownEndsAt: null,
  speedKmh: 0,
  boosting: false,
  nitroBottles: 3,
  nitroCharge: 0,
  driftChain: 0,
  driftScore: 0,
  lap: 1,
  totalLaps: 2,
  raceTimeMs: 0,
  results: null,
};

/** Transient race-session state; the canvas writes, the DOM HUD reads. */
export const useRaceStore = create<RaceStore>((set) => ({
  ...initial,
  patch: (partial) => set(partial),
  reset: () => set(initial),
}));
