import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import Redis from "ioredis";
import {
  MatchTicket,
  RaceMode,
  CarClass,
  TicketCar,
  TRACKS,
  DEFAULT_TRACK_ID,
} from "@drift/shared";
import { PrismaService } from "../prisma/prisma.service";
import { GarageService } from "../garage/garage.service";

@Injectable()
export class MatchmakingService implements OnModuleDestroy {
  private readonly redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
  private readonly jwt = new JwtService({ secret: process.env.JWT_ACCESS_SECRET });

  constructor(
    private readonly prisma: PrismaService,
    private readonly garage: GarageService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }

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

  /**
   * Resolve the car + handle a player races with (first garage car,
   * provisioning the starter if the garage is empty). Signed into the ticket
   * so the server sim and client prediction derive the identical profile.
   */
  async entrantFor(playerId: string): Promise<{ car: TicketCar; handle: string }> {
    await this.garage.ensureStarterCar(playerId);
    const [car, player] = await Promise.all([
      this.prisma.car.findFirst({
        where: { playerId },
        include: { upgrades: true },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.player.findUnique({ where: { id: playerId }, select: { handle: true } }),
    ]);
    const upgrades: Record<string, number> = {};
    for (const u of car!.upgrades) upgrades[u.slot] = u.tier;
    return {
      car: { carId: car!.id, modelKey: car!.modelKey, upgrades },
      handle: player?.handle ?? `racer_${playerId.slice(0, 6)}`,
    };
  }

  issueTicket(
    playerId: string,
    roomId: string,
    mode: RaceMode,
    carClass: CarClass,
    trackId: string = DEFAULT_TRACK_ID,
    opts: { car?: TicketCar; raceId?: string; handle?: string; bots?: number; botDifficulty?: string } = {},
  ): MatchTicket {
    if (!TRACKS[trackId]) trackId = DEFAULT_TRACK_ID;
    const { car, raceId, handle, bots, botDifficulty } = opts;
    const ticket = this.jwt.sign(
      { sub: playerId, roomId, mode, carClass, trackId, car, raceId, handle, bots, botDifficulty, aud: "realtime" },
      { expiresIn: "90s" },
    );
    return {
      ticket,
      roomId,
      realtimeUrl: process.env.NEXT_PUBLIC_REALTIME_URL ?? "ws://localhost:2567",
      mode,
      carClass,
      trackId,
      car,
      raceId,
      handle,
      bots,
      botDifficulty: botDifficulty as "easy" | "medium" | "hard" | undefined,
    };
  }
}
