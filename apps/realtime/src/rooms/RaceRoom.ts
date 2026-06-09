import { createHash } from "node:crypto";
import { Client, Room } from "@colyseus/core";
import jwt from "jsonwebtoken";
import {
  CarSimState,
  InputFrame,
  NEUTRAL_INPUT,
  RaceProgress,
  SIM_DT,
  SIM_TICK_RATE,
  Track,
  TRACKS,
  bankDrift,
  buildTrack,
  clampInput,
  collideWithWalls,
  createCarState,
  createProgress,
  poseAtS,
  sortStandings,
  stepCar,
  trackQuery,
  updateProgress,
} from "@drift/shared";
import { CarState, RaceState } from "./RaceState";

interface TicketClaims {
  sub: string; // playerId
  roomId: string;
}

/** Server-side bookkeeping per racer (never replicated). */
interface RacerCtx {
  sim: CarSimState;
  progress: RaceProgress;
  /** Pending input frames, ordered by seq. */
  queue: InputFrame[];
  /** Full input log — the replay, and the anti-cheat re-simulation source. */
  replay: InputFrame[];
  lastAckSeq: number;
}

const MAX_RACERS = 8;
const MAX_QUEUE = 8; // inputs buffered ahead; bursts beyond this are dropped
const COUNTDOWN_MS = 3000;
/** Stragglers get this long after the first finisher before the race closes. */
const STRAGGLER_WINDOW_MS = 60_000;

/**
 * Authoritative race room. Runs the shared deterministic car sim at a fixed
 * 30Hz tick, enforces track walls + ordered checkpoints server-side, acks
 * input seqs for client reconciliation, records input-stream replays, and
 * reports signed results to the API when the race closes.
 */
export class RaceRoom extends Room<RaceState> {
  override maxClients = MAX_RACERS + 50; // racers + spectators

  private track!: Track;
  private racers = new Map<string, RacerCtx>();
  private firstFinishMs: number | null = null;
  private resultReported = false;

  override onCreate(): void {
    this.setState(new RaceState());
    this.track = buildTrack(TRACKS[this.state.trackId]!);
    this.setSimulationInterval(() => this.simTick(), 1000 / SIM_TICK_RATE);

    this.onMessage("input.frame", (client, frame: InputFrame) => {
      const ctx = this.racers.get(client.sessionId);
      if (!ctx || !this.isValidFrame(frame, ctx)) return;
      if (ctx.queue.length >= MAX_QUEUE) ctx.queue.shift(); // drop oldest on burst
      ctx.queue.push(frame);
      ctx.queue.sort((a, b) => a.seq - b.seq);
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
    if (this.racers.size >= MAX_RACERS || this.state.phase !== "WAITING") return; // spectator

    // Grid slot: staggered pairs behind the start line.
    const slot = this.racers.size;
    const startS = this.track.totalLength - 6 - Math.floor(slot / 2) * 7;
    const pose = poseAtS(this.track, startS);
    const lateral = (slot % 2 === 0 ? 1 : -1) * 2.5;
    const sim = createCarState(
      pose.x + Math.cos(pose.yaw) * lateral,
      pose.z - Math.sin(pose.yaw) * lateral,
      pose.yaw,
    );

    this.racers.set(client.sessionId, {
      sim,
      progress: createProgress(trackQuery(this.track, sim.x, sim.z).s),
      queue: [],
      replay: [],
      lastAckSeq: 0,
    });

    const car = new CarState();
    car.playerId = claims.sub;
    car.handle = `racer_${claims.sub.slice(0, 6)}`;
    this.syncCar(car, this.racers.get(client.sessionId)!);
    this.state.cars.set(client.sessionId, car);
  }

  override onLeave(client: Client): void {
    this.state.cars.delete(client.sessionId);
    this.racers.delete(client.sessionId);
    if (this.state.phase === "RACING") this.maybeFinishRace();
  }

  // ── Simulation ───────────────────────────────────────────────────────────

  private simTick(): void {
    if (this.state.phase !== "RACING") return;
    this.state.tick++;
    this.state.raceTimeMs = Math.round(this.state.tick * SIM_DT * 1000);

    for (const [sessionId, ctx] of this.racers) {
      const car = this.state.cars.get(sessionId);
      if (!car) continue;

      // Consume exactly one input per tick (rates are matched at 30Hz);
      // coast on neutral input when the queue is dry (packet loss).
      let frame: InputFrame | undefined;
      while ((frame = ctx.queue[0]) && frame.seq <= ctx.lastAckSeq) ctx.queue.shift();
      frame = ctx.queue.shift();

      if (!ctx.progress.finished) {
        const input = frame ? clampInput(frame) : NEUTRAL_INPUT;
        stepCar(ctx.sim, input);
        collideWithWalls(this.track, ctx.sim);
        if (frame) {
          ctx.lastAckSeq = frame.seq;
          ctx.replay.push(frame);
        }
        const q = trackQuery(this.track, ctx.sim.x, ctx.sim.z);
        updateProgress(this.track, ctx.progress, q.s, this.state.raceTimeMs);
        if (ctx.progress.finished) {
          bankDrift(ctx.sim); // a chain alive at the line still counts
          this.firstFinishMs ??= this.state.raceTimeMs;
        }
      }
      this.syncCar(car, ctx);
    }

    this.maybeFinishRace();
  }

  /** Copy authoritative sim + progress into the replicated schema. */
  private syncCar(car: CarState, ctx: RacerCtx): void {
    const s = ctx.sim;
    car.x = s.x;
    car.z = s.z;
    car.yaw = s.yaw;
    car.vx = s.vx;
    car.vz = s.vz;
    car.nitroMs = s.nitroMs;
    car.bottles = s.bottles;
    car.nitroCharge = s.nitroCharge;
    car.driftChain = s.driftChain;
    car.driftScore = s.driftScore;
    car.driftGraceMs = s.driftGraceMs;
    car.drifting = s.drifting;
    car.lastAckSeq = ctx.lastAckSeq;
    car.lap = ctx.progress.lap;
    car.checkpoint = ctx.progress.cpIdx;
    car.progress = ctx.progress.p;
    car.finished = ctx.progress.finished;
    car.finishTimeMs = ctx.progress.finishTimeMs ?? 0;
  }

  // ── Validation / lifecycle ───────────────────────────────────────────────

  private isValidFrame(frame: InputFrame, ctx: RacerCtx): boolean {
    return (
      this.state.phase === "RACING" &&
      typeof frame?.seq === "number" &&
      Number.isInteger(frame.seq) &&
      frame.seq > ctx.lastAckSeq &&
      frame.seq < ctx.lastAckSeq + 1000 // wildly future seqs are garbage
    );
  }

  private maybeStartCountdown(): void {
    if (this.state.phase !== "WAITING" || this.racers.size === 0) return;
    const allReady = [...this.state.cars.values()].every((c) => c.ready);
    if (!allReady) return;

    this.lock(); // no new racers mid-race; spectators rejected at join anyway
    this.state.phase = "COUNTDOWN";
    this.broadcast("race.phase", { phase: "COUNTDOWN", countdownMs: COUNTDOWN_MS });
    this.clock.setTimeout(() => {
      this.state.phase = "RACING";
      this.broadcast("race.phase", { phase: "RACING" });
    }, COUNTDOWN_MS);
  }

  private maybeFinishRace(): void {
    if (this.state.phase !== "RACING" || this.racers.size === 0) return;
    const allDone = [...this.racers.values()].every((r) => r.progress.finished);
    const windowClosed =
      this.firstFinishMs !== null && this.state.raceTimeMs > this.firstFinishMs + STRAGGLER_WINDOW_MS;
    if (allDone || windowClosed) void this.finishRace();
  }

  private async finishRace(): Promise<void> {
    if (this.resultReported) return;
    this.resultReported = true;
    this.state.phase = "FINISHED";

    const ranked = sortStandings(
      [...this.racers.entries()].map(([sessionId, ctx]) => ({ sessionId, ctx, progress: ctx.progress })),
    );
    const standings = ranked.map((r, i) => ({
      playerId: this.state.cars.get(r.sessionId)?.playerId ?? "unknown",
      position: i + 1,
      finishTimeMs: r.progress.finishTimeMs,
    }));
    this.broadcast("race.phase", { phase: "FINISHED" });
    this.broadcast("race.result", { raceId: this.roomId, standings });

    const replayHash = createHash("sha256")
      .update(JSON.stringify([...this.racers.values()].map((r) => r.replay)))
      .digest("hex");

    await fetch(`${process.env.API_INTERNAL_URL ?? "http://localhost:4000"}/v1/internal/races/results`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-service-token": process.env.REALTIME_SERVICE_TOKEN ?? "",
      },
      body: JSON.stringify({
        raceId: crypto.randomUUID(), // roomIds are not UUIDs; race identity is server-issued
        mode: "CIRCUIT",
        trackId: this.state.trackId,
        serverSeed: this.roomId,
        startedAt: new Date(Date.now() - this.state.raceTimeMs).toISOString(),
        endedAt: new Date().toISOString(),
        replayHash,
        entries: ranked.map((r, i) => ({
          playerId: this.state.cars.get(r.sessionId)?.playerId ?? "unknown",
          finishPosition: i + 1,
          finishTimeMs: r.progress.finishTimeMs,
          bestLapMs: null,
          driftScore: Math.round(r.ctx.sim.driftScore),
          cleanRaceBonus: false,
        })),
      }),
    }).catch((err) => console.error("[realtime] result report failed", err));

    // Give clients time to show results, then dispose.
    this.clock.setTimeout(() => void this.disconnect(), 30_000);
  }
}
