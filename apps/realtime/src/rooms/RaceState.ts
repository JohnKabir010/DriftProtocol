import { MapSchema, Schema, type } from "@colyseus/schema";

/**
 * Replicated race state (binary-delta synced by Colyseus). The car fields
 * mirror the shared CarSimState exactly so the client can feed them straight
 * into PredictionBuffer.reconcile for the local car and into the snapshot
 * interpolator for remote cars. Pose/velocity use float64 — reconciliation
 * needs them bit-comparable with the client's own simulation.
 */
export class CarState extends Schema {
  @type("string") playerId = "";
  @type("string") handle = "";
  // CarSimState mirror ─────────────────────────────────────────────
  @type("number") x = 0;
  @type("number") z = 0;
  @type("number") yaw = 0;
  @type("number") vx = 0;
  @type("number") vz = 0;
  @type("number") nitroMs = 0;
  @type("uint8") bottles = 3;
  @type("number") nitroCharge = 0;
  @type("number") driftChain = 0;
  @type("number") driftScore = 0;
  @type("number") driftGraceMs = 0;
  @type("boolean") drifting = false;
  // Netcode / race progress ────────────────────────────────────────
  @type("uint32") lastAckSeq = 0;
  @type("uint8") lap = 0;
  @type("uint8") checkpoint = 0;
  @type("number") progress = 0; // meters covered, for live position UI
  @type("boolean") finished = false;
  @type("uint32") finishTimeMs = 0;
  @type("boolean") ready = false;
}

export class RaceState extends Schema {
  @type("string") phase: "WAITING" | "COUNTDOWN" | "RACING" | "FINISHED" = "WAITING";
  @type("uint32") tick = 0;
  @type("number") raceTimeMs = 0;
  @type("string") trackId = "neon-row-circuit";
  @type({ map: CarState }) cars = new MapSchema<CarState>();
}
