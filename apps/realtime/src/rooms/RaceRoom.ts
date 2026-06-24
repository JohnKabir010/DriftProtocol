import { createHash } from "node:crypto";
import { Client, Room } from "@colyseus/core";
import jwt from "jsonwebtoken";
import {
  BOT_PROFILES,
  BotProfile,
  CarSimState,
  HandlingProfile,
  InputFrame,
  NEUTRAL_HANDLING,
  NEUTRAL_INPUT,
  RaceProgress,
  SIM_DT,
  SIM_TICK_RATE,
  TicketCar,
  Track,
  TRACKS,
  bankDrift,
  botInput,
  buildTrack,
  clampInput,
  collideWithWalls,
  createCarState,
  createProgress,
  poseAtS,
  resolveHandling,
  sortStandings,
  stepCarResolved,
  trackQuery,
  updateProgress,
} from "@drift/shared";
import { CarState, RaceState } from "./RaceState";

interface TicketClaims {
  sub: string; // playerId
  roomId: string;
  mode?: string;
  trackId?: string;
  /** Car payload signed by the API — the only source of per-car stats. */
  car?: TicketCar;
  /** Pre-created Race row for matchmade races (betting + result identity). */
  raceId?: string;
  handle?: string;
  /** Bot drivers the matchmaker asked this room to spawn. */
  bots?: number;
  /** Difficulty level for BOT_RACE rooms — controls profile selection. */
  botDifficulty?: string;
}

interface JoinOptions {
  ticket?: string;
  matchId?: string;
  trackId?: string;
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
  /** Handling profile resolved from the signed ticket — per-car physics. */
  profile: HandlingProfile;
  carId: string | null;
  /** Set for AI drivers — input comes from botInput, not a client. */
  bot: BotProfile | null;
}

const MAX_RACERS = 8;
const MAX_QUEUE = 8; // inputs buffered ahead; bursts beyond this are dropped
const COUNTDOWN_MS = 3000;
/** Stragglers get this long after the first finisher before the race closes. */
const STRAGGLER_WINDOW_MS = 60_000;
/** Absolute cap — a wedged race must still close, report, and free the room. */
const MAX_RACE_TIME_MS = 8 * 60_000;

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

  private matchId = "";
  /** Pre-created Race row (from ticket claims) — result + betting identity. */
  private raceId: string | null = null;
  private raceMode = "CIRCUIT";
  private botDifficulty: string | null = null;

  override onCreate(options: JoinOptions): void {
    this.setState(new RaceState());
    // Track/match come from the creating client's options but are bound to
    // signed ticket claims in onAuth — a mismatch rejects the join.
    this.matchId = options.matchId ?? this.roomId;
    if (options.trackId && TRACKS[options.trackId]) this.state.trackId = options.trackId;
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
  override onAuth(_client: Client, options: JoinOptions): TicketClaims {
    if (!options.ticket) throw new Error("ticket required");
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new Error("realtime misconfigured: JWT_ACCESS_SECRET missing");
    const claims = jwt.verify(options.ticket, secret) as TicketClaims;
    // Bind the signed ticket to this room: an access token (no roomId) or a
    // ticket for a different match cannot be replayed here.
    if (!claims.roomId || claims.roomId !== this.matchId) throw new Error("ticket not valid for this room");
    if (claims.trackId && claims.trackId !== this.state.trackId) throw new Error("track mismatch");
    return claims;
  }

  /** Grid slot: staggered pairs behind the start line. */
  private gridSim(slot: number): CarSimState {
    const startS = this.track.totalLength - 6 - Math.floor(slot / 2) * 7;
    const pose = poseAtS(this.track, startS);
    const lateral = (slot % 2 === 0 ? 1 : -1) * 2.5;
    return createCarState(
      pose.x + Math.cos(pose.yaw) * lateral,
      pose.z - Math.sin(pose.yaw) * lateral,
      pose.yaw,
    );
  }

  /** Bot drivers the matchmaker asked for — spawned when the countdown locks. */
  private pendingBots = 0;

  override onJoin(client: Client, _options: unknown, claims?: TicketClaims): void {
    if (!claims) throw new Error("unauthenticated join");
    if (this.racers.size >= MAX_RACERS || this.state.phase !== "WAITING") return; // spectator

    const sim = this.gridSim(this.racers.size);

    // Per-car physics: resolve the handling profile from the SIGNED ticket.
    // An invalid/missing payload falls back to the neutral profile.
    let profile: HandlingProfile = NEUTRAL_HANDLING;
    if (claims.car) {
      try {
        profile = resolveHandling(claims.car.modelKey, claims.car.upgrades as never);
      } catch {
        /* unknown model — race stock */
      }
    }
    this.raceId ??= claims.raceId ?? null;
    if (claims.mode) this.raceMode = claims.mode;
    if (claims.botDifficulty) this.botDifficulty = claims.botDifficulty;
    this.pendingBots = Math.max(this.pendingBots, Math.min(claims.bots ?? 0, BOT_PROFILES.length));

    this.racers.set(client.sessionId, {
      sim,
      progress: createProgress(trackQuery(this.track, sim.x, sim.z).s),
      queue: [],
      replay: [],
      lastAckSeq: 0,
      profile,
      carId: claims.car?.carId ?? null,
      bot: null,
    });

    const car = new CarState();
    car.playerId = claims.sub;
    car.handle = claims.handle ?? `racer_${claims.sub.slice(0, 6)}`;
    this.syncCar(car, this.racers.get(client.sessionId)!);
    this.state.cars.set(client.sessionId, car);
  }

  /** Returns BOT_PROFILES indices ordered by difficulty (easiest = slowest bots first). */
  private botProfileOrder(): readonly BotProfile[] {
    switch (this.botDifficulty) {
      case "easy":   return [BOT_PROFILES[3]!, BOT_PROFILES[2]!, BOT_PROFILES[1]!]; // GHOSTLINE, KIRIN, NULLDRIVE
      case "medium": return [BOT_PROFILES[2]!, BOT_PROFILES[1]!, BOT_PROFILES[0]!]; // KIRIN, NULLDRIVE, VEC-7
      default:       return [BOT_PROFILES[0]!, BOT_PROFILES[1]!, BOT_PROFILES[2]!]; // VEC-7, NULLDRIVE, KIRIN (hard)
    }
  }

  /** Fill the remaining grid with AI drivers (replicated like any other car). */
  private spawnBots(): void {
    const profiles = this.botProfileOrder();
    for (let i = 0; i < this.pendingBots && this.racers.size < MAX_RACERS; i++) {
      const profile = profiles[i]!;
      const key = `bot:${i}`;
      const sim = this.gridSim(this.racers.size);

      this.racers.set(key, {
        sim,
        progress: createProgress(trackQuery(this.track, sim.x, sim.z).s),
        queue: [],
        replay: [],
        lastAckSeq: 0,
        profile: NEUTRAL_HANDLING, // bots drive the stock baseline — beatable by upgrades
        carId: null,
        bot: profile,
      });

      const car = new CarState();
      car.playerId = ""; // empty = AI; never appears in result reports
      car.handle = profile.handle;
      car.ready = true;
      this.syncCar(car, this.racers.get(key)!);
      this.state.cars.set(key, car);
    }
    this.pendingBots = 0;
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
        const input = ctx.bot
          ? botInput(this.track, ctx.sim, ctx.bot, this.state.tick)
          : frame
            ? clampInput(frame)
            : NEUTRAL_INPUT;
        stepCarResolved(ctx.sim, input, ctx.profile);
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

    this.spawnBots(); // fill the rest of the grid with AI drivers
    this.lock(); // no new racers mid-race; spectators rejected at join anyway
    this.state.phase = "COUNTDOWN";
    this.broadcast("race.phase", { phase: "COUNTDOWN", countdownMs: COUNTDOWN_MS });
    this.clock.setTimeout(() => {
      this.state.phase = "RACING";
      this.broadcast("race.phase", { phase: "RACING" });
      this.lockBetPools(); // green light — no more bets on this race
    }, COUNTDOWN_MS);
  }

  /** Best-effort: betting pools also auto-expire via closesAt on the API. */
  private lockBetPools(): void {
    if (!this.raceId) return;
    void fetch(
      `${process.env.API_INTERNAL_URL ?? "http://localhost:4000"}/v1/internal/races/${this.raceId}/lock-pools`,
      {
        method: "POST",
        headers: { "x-service-token": process.env.REALTIME_SERVICE_TOKEN ?? "" },
      },
    ).catch((err) => console.error("[realtime] lock-pools failed", err));
  }

  private maybeFinishRace(): void {
    if (this.state.phase !== "RACING" || this.racers.size === 0) return;
    const allDone = [...this.racers.values()].every((r) => r.progress.finished);
    const windowClosed =
      this.firstFinishMs !== null && this.state.raceTimeMs > this.firstFinishMs + STRAGGLER_WINDOW_MS;
    const timedOut = this.state.raceTimeMs > MAX_RACE_TIME_MS;
    if (allDone || windowClosed || timedOut) void this.finishRace();
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
      handle: this.state.cars.get(r.sessionId)?.handle ?? "unknown",
      position: i + 1,
      finishTimeMs: r.progress.finishTimeMs,
    }));
    this.broadcast("race.phase", { phase: "FINISHED" });
    this.broadcast("race.result", { raceId: this.roomId, standings });

    const replayHash = createHash("sha256")
      .update(JSON.stringify([...this.racers.values()].map((r) => r.replay)))
      .digest("hex");

    const report = JSON.stringify({
      // Matchmade races report under the pre-created raceId (betting +
      // idempotency); quick-play rooms mint a fresh identity.
      raceId: this.raceId ?? crypto.randomUUID(),
      mode: this.raceMode,
      ...(this.botDifficulty ? { botDifficulty: this.botDifficulty } : {}),
      trackId: this.state.trackId,
      serverSeed: this.roomId,
      startedAt: new Date(Date.now() - this.state.raceTimeMs).toISOString(),
      endedAt: new Date().toISOString(),
      replayHash,
      // Humans only: bots have no Player row and must never earn rewards.
      // Positions are OVERALL (bots included) — finishing behind a bot costs
      // you places, which is what keeps bot races honest.
      entries: ranked
        .map((r, i) => ({ r, position: i + 1 }))
        .filter(({ r }) => !r.ctx.bot)
        .map(({ r, position }) => ({
          playerId: this.state.cars.get(r.sessionId)?.playerId ?? "unknown",
          carId: r.ctx.carId ?? undefined,
          finishPosition: position,
          finishTimeMs: r.progress.finishTimeMs,
          bestLapMs: null,
          driftScore: Math.round(r.ctx.sim.driftScore),
          cleanRaceBonus: false,
        })),
    });

    // Rewards depend on this report landing — retry with backoff. The API
    // dedupes on raceId, so a retry after a slow success cannot double-pay.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(
          `${process.env.API_INTERNAL_URL ?? "http://localhost:4000"}/v1/internal/races/results`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-service-token": process.env.REALTIME_SERVICE_TOKEN ?? "",
            },
            body: report,
          },
        );
        if (res.ok) break;
        console.error(`[realtime] result report rejected (${res.status}), attempt ${attempt + 1}`);
      } catch (err) {
        console.error(`[realtime] result report failed, attempt ${attempt + 1}`, err);
      }
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }

    // Give clients time to show results, then dispose.
    this.clock.setTimeout(() => void this.disconnect(), 30_000);
  }
}
