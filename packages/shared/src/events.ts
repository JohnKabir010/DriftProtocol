/**
 * Typed WebSocket protocol between the web client and the Colyseus realtime fleet.
 * High-rate state replication uses Colyseus schema (binary); the messages here
 * are the low-rate, explicitly-typed channel.
 */

// ── Client → Server ────────────────────────────────────────────────────────

/** One compressed input frame, sent at the client input rate (≤60Hz). */
export interface InputFrame {
  /** Monotonic per-player sequence number, used for server ack + reconciliation. */
  seq: number;
  /** Client simulation tick this frame applies to. */
  tick: number;
  steer: number; // [-1, 1]
  throttle: number; // [0, 1]
  brake: number; // [0, 1]
  handbrake: boolean;
  nitro: boolean;
}

export interface ClientMessages {
  "input.frame": InputFrame;
  "race.ready": Record<string, never>;
  "chat.msg": { text: string };
}

// ── Server → Client ────────────────────────────────────────────────────────

export type RacePhase = "WAITING" | "COUNTDOWN" | "RACING" | "FINISHED";

export interface ServerMessages {
  "race.phase": { phase: RacePhase; countdownMs?: number };
  /** Ack of the last processed input seq, so the client can drop confirmed frames. */
  "input.ack": { seq: number; tick: number };
  "race.result": {
    raceId: string;
    standings: Array<{
      playerId: string; // empty string = AI driver
      handle: string;
      position: number;
      finishTimeMs: number | null;
    }>;
  };
  "chat.msg": { playerId: string; handle: string; text: string };
  "system.kick": { reason: string };
}

export type ClientMessageType = keyof ClientMessages;
export type ServerMessageType = keyof ServerMessages;
