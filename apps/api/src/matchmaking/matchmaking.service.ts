import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import Redis from "ioredis";
import { MatchTicket, RaceMode, CarClass } from "@drift/shared";

@Injectable()
export class MatchmakingService {
  private readonly redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
  private readonly jwt = new JwtService({ secret: process.env.JWT_ACCESS_SECRET });

  /** Exposed to the worker so it can build and purge queue keys. */
  queueKey(mode: RaceMode, carClass: CarClass): string {
    return `mm:queue:${mode}:${carClass}`;
  }

  async enqueue(playerId: string, mode: RaceMode, carClass: CarClass): Promise<void> {
    await this.redis.zadd(this.queueKey(mode, carClass), Date.now(), playerId);
  }

  async dequeue(playerId: string, mode: RaceMode, carClass: CarClass): Promise<void> {
    await this.redis.zrem(this.queueKey(mode, carClass), playerId);
  }

  /** Poll for a ready ticket (set by the worker). Returns null if not yet ready. */
  async pollTicket(playerId: string): Promise<MatchTicket | null> {
    const raw = await this.redis.get(`mm:ticket:${playerId}`);
    if (!raw) return null;
    await this.redis.del(`mm:ticket:${playerId}`);
    return JSON.parse(raw) as MatchTicket;
  }

  issueTicket(playerId: string, roomId: string, mode: RaceMode, carClass: CarClass): MatchTicket {
    const ticket = this.jwt.sign(
      { sub: playerId, roomId, mode, carClass },
      { expiresIn: "90s" },
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
