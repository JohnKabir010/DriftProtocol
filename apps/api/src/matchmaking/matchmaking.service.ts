import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import Redis from "ioredis";
import { MatchTicket, RaceMode, CarClass } from "@drift/shared";

/**
 * Phase-1 matchmaking: Redis sorted-set queues keyed by (mode, class),
 * scored by enqueue time. A 2s matcher tick greedily fills lobbies and
 * issues signed room tickets the client redeems with the Colyseus fleet.
 * Rep-tier bracketing and tolerance widening land in Phase 3.
 */
@Injectable()
export class MatchmakingService {
  private readonly redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
  private readonly jwt = new JwtService({ secret: process.env.JWT_ACCESS_SECRET });

  private queueKey(mode: RaceMode, carClass: CarClass): string {
    return `mm:queue:${mode}:${carClass}`;
  }

  async enqueue(playerId: string, mode: RaceMode, carClass: CarClass): Promise<void> {
    await this.redis.zadd(this.queueKey(mode, carClass), Date.now(), playerId);
  }

  async dequeue(playerId: string, mode: RaceMode, carClass: CarClass): Promise<void> {
    await this.redis.zrem(this.queueKey(mode, carClass), playerId);
  }

  /** Issue a ticket binding this player to a specific room and seat. */
  issueTicket(playerId: string, roomId: string, mode: RaceMode, carClass: CarClass): MatchTicket {
    const ticket = this.jwt.sign(
      { sub: playerId, roomId, mode, carClass },
      { expiresIn: "60s" },
    );
    return {
      ticket,
      roomId,
      realtimeUrl: process.env.NEXT_PUBLIC_REALTIME_URL ?? "ws://localhost:2567",
      mode,
      carClass,
    };
  }
}
