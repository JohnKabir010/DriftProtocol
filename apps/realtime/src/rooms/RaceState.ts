import { MapSchema, Schema, type } from "@colyseus/schema";

/**
 * Replicated race state (binary-delta synced by Colyseus). Positions are the
 * server-authoritative physics output; clients interpolate remote cars and
 * reconcile their own against this.
 */
export class CarState extends Schema {
  @type("string") playerId = "";
  @type("string") handle = "";
  @type("float32") x = 0;
  @type("float32") y = 0;
  @type("float32") z = 0;
  @type("float32") yaw = 0;
  @type("float32") speed = 0;
  @type("uint32") lastAckSeq = 0; // last processed input seq, for client reconciliation
  @type("uint8") nitroBottles = 3;
  @type("uint32") driftScore = 0;
  @type("uint8") checkpoint = 0;
  @type("uint8") lap = 0;
  @type("boolean") finished = false;
  @type("boolean") ready = false;
}

export class RaceState extends Schema {
  @type("string") phase: "WAITING" | "COUNTDOWN" | "RACING" | "FINISHED" = "WAITING";
  @type("uint32") tick = 0;
  @type("string") trackId = "neon-row-sprint";
  @type({ map: CarState }) cars = new MapSchema<CarState>();
}
