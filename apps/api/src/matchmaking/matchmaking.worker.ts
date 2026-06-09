import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import Redis from "ioredis";
import { RaceMode, CarClass } from "@drift/shared";
import { MatchmakingService } from "./matchmaking.service";

const MODES: RaceMode[] = ["SPRINT", "CIRCUIT", "DRIFT_TRIAL"];
const CLASSES: CarClass[] = ["D", "C", "B", "A", "S"];
const LOBBY_SIZE = 4; // fill a room once this many players are queued
const BOT_BACKFILL_AFTER_MS = 20_000; // backfill if we can't fill after 20s
const TICK_MS = 2_000;

/**
 * Runs on module init. Every 2s, scans all (mode, class) queues and forms
 * rooms when enough players are queued. Below liquidity threshold, backfills
 * with bot slots (clearly labelled in Phase 3; real bots drive in Phase 6).
 *
 * In Phase 3 the worker runs in-process on the API. Phase B extracts it as
 * a standalone service with a Redis Stream fanout so multiple API replicas
 * don't race on the same queues.
 */
@Injectable()
export class MatchmakingWorker implements OnModuleInit {
  private readonly redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
  private readonly logger = new Logger(MatchmakingWorker.name);

  constructor(private readonly mm: MatchmakingService) {}

  onModuleInit(): void {
    void this.tick();
  }

  private async tick(): Promise<void> {
    while (true) {
      await new Promise((r) => setTimeout(r, TICK_MS));
      try {
        await this.scan();
      } catch (err) {
        this.logger.error("matchmaking tick failed", err);
      }
    }
  }

  private async scan(): Promise<void> {
    for (const mode of MODES) {
      for (const carClass of CLASSES) {
        await this.tryForm(mode, carClass);
      }
    }
  }

  private async tryForm(mode: RaceMode, carClass: CarClass): Promise<void> {
    const key = this.mm.queueKey(mode, carClass);
    const now = Date.now();

    // Get up to LOBBY_SIZE players ordered by queue entry time.
    const members = await this.redis.zrange(key, 0, LOBBY_SIZE - 1, "WITHSCORES");
    const players: Array<{ id: string; enqueuedAt: number }> = [];
    for (let i = 0; i < members.length; i += 2) {
      players.push({ id: members[i]!, enqueuedAt: Number(members[i + 1]) });
    }

    if (players.length === 0) return;

    const canFill = players.length >= LOBBY_SIZE;
    const canBackfill =
      players.length >= 1 && players[0] && now - players[0].enqueuedAt >= BOT_BACKFILL_AFTER_MS;

    if (!canFill && !canBackfill) return;

    const roomId = `room_${mode}_${carClass}_${Date.now()}`;
    const selected = players.slice(0, LOBBY_SIZE);
    const botsNeeded = canBackfill && !canFill ? LOBBY_SIZE - selected.length : 0;

    this.logger.log(
      `forming room ${roomId} — ${selected.length} players + ${botsNeeded} bot slots (${mode}/${carClass})`,
    );

    // Remove matched players from the queue.
    await this.redis.zrem(key, ...selected.map((p) => p.id));

    // Issue tickets and publish them via Redis so the client polling can pick up.
    for (const p of selected) {
      const ticket = this.mm.issueTicket(p.id, roomId, mode, carClass);
      await this.redis.setex(`mm:ticket:${p.id}`, 90, JSON.stringify(ticket));
      await this.redis.publish(`mm:ready:${p.id}`, JSON.stringify(ticket));
    }

    // Bot slots published as synthetic tickets (no real player).
    for (let i = 0; i < botsNeeded; i++) {
      this.logger.log(`  bot slot ${i + 1}/${botsNeeded} reserved for ${roomId}`);
    }
  }
}
