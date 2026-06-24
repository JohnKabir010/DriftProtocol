"use client";

import { Client, Room } from "colyseus.js";
import {
  CarInput,
  CarSimState,
  HandlingProfile,
  INTERP_DELAY_MS,
  NEUTRAL_HANDLING,
  PredictionBuffer,
  SnapshotInterpolator,
  TicketCar,
  Track,
  createCarState,
  resolveHandling,
} from "@drift/shared";
import { useRaceStore } from "@/stores/raceStore";
import { useSessionStore } from "@/stores/sessionStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL ?? "ws://localhost:2567";

/** Shape of the replicated car schema we consume (mirror of server CarState). */
interface NetCar extends CarSimState {
  playerId: string;
  handle: string;
  lastAckSeq: number;
  lap: number;
  progress: number;
  finished: boolean;
  finishTimeMs: number;
}

function toSimState(c: NetCar): CarSimState {
  return {
    x: c.x,
    z: c.z,
    yaw: c.yaw,
    vx: c.vx,
    vz: c.vz,
    nitroMs: c.nitroMs,
    bottles: c.bottles,
    nitroCharge: c.nitroCharge,
    driftChain: c.driftChain,
    driftScore: c.driftScore,
    driftGraceMs: c.driftGraceMs,
    drifting: c.drifting,
  };
}

/**
 * Online race session: guest auth → matchmaking ticket → Colyseus room.
 * Owns the prediction buffer for the local car and snapshot interpolators
 * for remote cars; patches the HUD store from server messages.
 */
export class OnlineSession {
  prediction: PredictionBuffer;
  readonly remotes = new Map<string, SnapshotInterpolator>();
  onRemotesChanged: ((ids: string[]) => void) | null = null;

  private constructor(
    private readonly room: Room,
    track: Track,
    profile: HandlingProfile,
  ) {
    // Profile must match what the server resolved from the same signed ticket,
    // or reconciliation rewinds every frame.
    this.prediction = new PredictionBuffer(createCarState(0, 0, 0), track, profile);
    this.wire();
  }

  static async connect(track: Track, opts?: { difficulty?: "easy" | "medium" | "hard" }): Promise<OnlineSession> {
    // Reuse the signed-in session so race rewards land on the player's real
    // account; only fall back to a throwaway guest when there is none.
    let accessToken = useSessionStore.getState().accessToken;
    if (!accessToken) {
      const guestRes = await fetch(`${API_URL}/v1/auth/guest`, { method: "POST" });
      if (!guestRes.ok) throw new Error(`guest auth failed: ${guestRes.status}`);
      ({ accessToken } = (await guestRes.json()) as { accessToken: string });
    }

    const isBotRace = !!opts?.difficulty;
    const ticketRes = await fetch(
      isBotRace ? `${API_URL}/v1/matchmaking/bot-race` : `${API_URL}/v1/matchmaking/quick`,
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: isBotRace
          ? JSON.stringify({ trackId: track.def.id, difficulty: opts!.difficulty })
          : JSON.stringify({ mode: "CIRCUIT", carClass: "C", trackId: track.def.id }),
      },
    );
    if (!ticketRes.ok) throw new Error(`matchmaking failed: ${ticketRes.status}`);
    const { ticket, roomId, trackId, car } = (await ticketRes.json()) as {
      ticket: string;
      roomId: string;
      trackId?: string;
      car?: TicketCar;
    };

    // Resolve the per-car handling profile from the SAME payload the server
    // verifies out of the ticket — both sims must be identical.
    let profile: HandlingProfile = NEUTRAL_HANDLING;
    if (car) {
      try {
        profile = resolveHandling(car.modelKey, car.upgrades as never);
      } catch {
        /* unknown model — predict stock; server does the same */
      }
    }

    const client = new Client(REALTIME_URL);
    // joinOrCreate + matchId filter: everyone holding a ticket for the same
    // matchmade roomId lands in the same Colyseus room.
    const room = await client.joinOrCreate("race", {
      ticket,
      matchId: roomId,
      trackId: trackId ?? track.def.id,
    });
    return new OnlineSession(room, track, profile);
  }

  private wire(): void {
    const store = useRaceStore.getState();

    this.room.onMessage("race.phase", (msg: { phase: string; countdownMs?: number }) => {
      if (msg.phase === "COUNTDOWN") {
        useRaceStore.getState().patch({
          phase: "COUNTDOWN",
          countdownEndsAt: Date.now() + (msg.countdownMs ?? 3000),
        });
      } else {
        useRaceStore.getState().patch({ phase: msg.phase as "RACING" | "FINISHED" });
      }
    });

    this.room.onMessage(
      "race.result",
      (msg: {
        standings: Array<{ playerId: string; handle: string; position: number; finishTimeMs: number | null }>;
      }) => {
        const cars: NetCar[] = [];
        this.room.state.cars.forEach((c: NetCar) => cars.push(c));
        const myCar = this.room.state.cars.get(this.room.sessionId) as NetCar | undefined;
        useRaceStore.getState().patch({
          phase: "FINISHED",
          results: msg.standings.map((s) => {
            // Match by handle for bots (playerId is empty for AI drivers).
            const car = cars.find((c) => (s.playerId ? c.playerId === s.playerId : c.handle === s.handle));
            return {
              handle: s.handle,
              position: s.position,
              finishTimeMs: s.finishTimeMs,
              driftScore: Math.round(car?.driftScore ?? 0),
              isLocal: !!s.playerId && s.playerId === myCar?.playerId,
            };
          }),
        });
      },
    );

    this.room.onStateChange(() => {
      const now = performance.now();
      const seen = new Set<string>();
      let remotesChanged = false;

      this.room.state.cars.forEach((car: NetCar, sessionId: string) => {
        if (sessionId === this.room.sessionId) {
          this.prediction.reconcile(toSimState(car), car.lastAckSeq);
          useRaceStore.getState().patch({
            lap: Math.min(car.lap + 1, useRaceStore.getState().totalLaps),
            raceTimeMs: this.room.state.raceTimeMs,
          });
        } else {
          seen.add(sessionId);
          let interp = this.remotes.get(sessionId);
          if (!interp) {
            interp = new SnapshotInterpolator();
            this.remotes.set(sessionId, interp);
            remotesChanged = true;
          }
          interp.push({ t: now, x: car.x, z: car.z, yaw: car.yaw });
        }
      });

      for (const id of this.remotes.keys()) {
        if (!seen.has(id)) {
          this.remotes.delete(id);
          remotesChanged = true;
        }
      }
      if (remotesChanged) this.onRemotesChanged?.([...this.remotes.keys()]);
    });

    store.patch({ phase: "WAITING" });
  }

  /** Advance one local prediction tick and ship the input frame. */
  tick(input: CarInput): void {
    const seq = this.prediction.step(input);
    this.room.send("input.frame", { seq, tick: 0, ...input });
  }

  ready(): void {
    this.room.send("race.ready", {});
  }

  /** Render time for remote interpolation (delayed by the jitter buffer). */
  remoteRenderTime(): number {
    return performance.now() - INTERP_DELAY_MS;
  }

  leave(): void {
    void this.room.leave();
  }
}
