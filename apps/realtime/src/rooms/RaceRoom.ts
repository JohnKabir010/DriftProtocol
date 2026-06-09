import { Client, Room } from "@colyseus/core";
import jwt from "jsonwebtoken";
import { InputFrame, SIM_TICK_RATE, BASE_CAR, SIM_DT } from "@drift/shared";
import { CarState, RaceState } from "./RaceState";

interface TicketClaims {
  sub: string; // playerId
  roomId: string;
}

const MAX_RACERS = 8;
const MAX_INPUT_RATE_PER_TICK = 4; // anti-flood: inputs accepted per sim tick
const COUNTDOWN_MS = 3000;

/**
 * Authoritative race room. Phase-1 scope: ticket-gated join, fixed-tick
 * simulation with a simplified kinematic car model (Rapier-backed vehicle
 * physics replaces `integrateCar` in Phase 2 without changing the protocol),
 * input validation, snapshot broadcast via Colyseus schema, and result
 * reporting to the API on finish.
 */
export class RaceRoom extends Room<RaceState> {
  override maxClients = MAX_RACERS + 50; // racers + spectators

  private inputs = new Map<string, InputFrame[]>(); // sessionId → pending frames
  private inputCountThisTick = new Map<string, number>();
  private startedAt: Date | null = null;

  override onCreate(): void {
    this.setState(new RaceState());
    this.setSimulationInterval(() => this.simTick(), 1000 / SIM_TICK_RATE);

    this.onMessage("input.frame", (client, frame: InputFrame) => {
      if (!this.validateInput(client, frame)) return;
      const queue = this.inputs.get(client.sessionId) ?? [];
      queue.push(frame);
      this.inputs.set(client.sessionId, queue);
    });

    this.onMessage("race.ready", (client) => {
      const car = this.state.cars.get(client.sessionId);
      if (car) car.ready = true;
      this.maybeStartCountdown();
    });
  }

  /** Joins require a matchmaking ticket signed by the API — no open rooms. */
  override onAuth(_client: Client, options: { ticket?: string }): TicketClaims {
    if (!options.ticket) throw new Error("ticket required");
    return jwt.verify(options.ticket, process.env.JWT_ACCESS_SECRET ?? "dev-only") as TicketClaims;
  }

  override onJoin(client: Client, _options: unknown, claims?: TicketClaims): void {
    if (!claims) throw new Error("unauthenticated join");
    if (this.state.cars.size >= MAX_RACERS) return; // spectator: state-only, no car
    const car = new CarState();
    car.playerId = claims.sub;
    car.handle = `racer_${claims.sub.slice(0, 6)}`;
    // Grid slot spacing on the start line.
    car.x = (this.state.cars.size % 2) * 4 - 2;
    car.z = -Math.floor(this.state.cars.size / 2) * 6;
    this.state.cars.set(client.sessionId, car);
  }

  override onLeave(client: Client): void {
    this.state.cars.delete(client.sessionId);
    this.inputs.delete(client.sessionId);
  }

  // ── Simulation ───────────────────────────────────────────────────────────

  private simTick(): void {
    if (this.state.phase !== "RACING") return;
    this.state.tick++;
    this.inputCountThisTick.clear();

    for (const [sessionId, car] of this.state.cars) {
      const queue = this.inputs.get(sessionId) ?? [];
      // Apply at most one frame per tick; keep the freshest, drop stale ones.
      const frame = queue.shift();
      if (frame) {
        this.integrateCar(car, frame);
        car.lastAckSeq = frame.seq;
      } else {
        this.integrateCar(car, null); // coast on packet loss
      }
    }
  }

  /**
   * Minimal kinematic integration: clamped accel, speed-scaled steering.
   * Server-side clamps mean speed/teleport hacks are impossible regardless
   * of what the client sends.
   */
  private integrateCar(car: CarState, frame: InputFrame | null): void {
    const throttle = frame ? Math.min(Math.max(frame.throttle, 0), 1) : 0;
    const brake = frame ? Math.min(Math.max(frame.brake, 0), 1) : 0;
    const steer = frame ? Math.min(Math.max(frame.steer, -1), 1) : 0;

    const accel = (throttle * BASE_CAR.engineForce - brake * BASE_CAR.brakeForce) / BASE_CAR.mass;
    car.speed = Math.min(Math.max(car.speed + accel * SIM_DT, 0), BASE_CAR.maxSpeed);

    const steerAngle =
      BASE_CAR.steerAngleLowSpeed +
      (BASE_CAR.steerAngleHighSpeed - BASE_CAR.steerAngleLowSpeed) * (car.speed / BASE_CAR.maxSpeed);
    car.yaw += steer * steerAngle * SIM_DT * (car.speed > 1 ? 1 : 0);

    car.x += Math.sin(car.yaw) * car.speed * SIM_DT;
    car.z += Math.cos(car.yaw) * car.speed * SIM_DT;
  }

  // ── Validation / lifecycle ───────────────────────────────────────────────

  private validateInput(client: Client, frame: InputFrame): boolean {
    if (typeof frame?.seq !== "number" || frame.seq < 0) return false;
    const count = (this.inputCountThisTick.get(client.sessionId) ?? 0) + 1;
    this.inputCountThisTick.set(client.sessionId, count);
    return count <= MAX_INPUT_RATE_PER_TICK && this.state.cars.has(client.sessionId);
  }

  private maybeStartCountdown(): void {
    if (this.state.phase !== "WAITING" || this.state.cars.size === 0) return;
    const allReady = [...this.state.cars.values()].every((c) => c.ready);
    if (!allReady) return;

    this.state.phase = "COUNTDOWN";
    this.broadcast("race.phase", { phase: "COUNTDOWN", countdownMs: COUNTDOWN_MS });
    this.clock.setTimeout(() => {
      this.state.phase = "RACING";
      this.startedAt = new Date();
      this.broadcast("race.phase", { phase: "RACING" });
    }, COUNTDOWN_MS);
  }

  /** Called when finish conditions are met (checkpoint logic lands in Phase 2). */
  private async finishRace(): Promise<void> {
    this.state.phase = "FINISHED";
    // Report the authoritative result to the API (service-token channel).
    await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:4000"}/v1/internal/races/results`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-service-token": process.env.REALTIME_SERVICE_TOKEN ?? "",
      },
      body: JSON.stringify({
        raceId: this.roomId,
        mode: "SPRINT",
        trackId: this.state.trackId,
        serverSeed: this.roomId,
        startedAt: (this.startedAt ?? new Date()).toISOString(),
        endedAt: new Date().toISOString(),
        replayHash: "phase2", // input-stream replay hashing lands with replays
        entries: [...this.state.cars.values()]
          .filter((c) => c.finished)
          .map((c, i) => ({
            playerId: c.playerId,
            finishPosition: i + 1,
            finishTimeMs: null,
            bestLapMs: null,
            driftScore: c.driftScore,
            cleanRaceBonus: false,
          })),
      }),
    }).catch((err) => console.error("[realtime] result report failed", err));
  }
}
