import { Body, Controller, Delete, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { z } from "zod";
import { RaceMode, CarClass, MatchTicket, TRACKS, DEFAULT_TRACK_ID } from "@drift/shared";
import { MatchmakingService } from "./matchmaking.service";
import { PrismaService } from "../prisma/prisma.service";
import type { JwtPayload } from "../auth/jwt.strategy";

const QueueBody = z.object({
  mode: RaceMode,
  carClass: CarClass,
  trackId: z
    .string()
    .refine((t) => t in TRACKS, "unknown track")
    .optional(),
});

const BotRaceBody = z.object({
  trackId: z.string().refine((t) => t in TRACKS, "unknown track"),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

@Controller("matchmaking")
@UseGuards(AuthGuard("jwt"))
export class MatchmakingController {
  constructor(
    private readonly mm: MatchmakingService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("queue")
  async queue(@Body() body: unknown, @Req() req: { user: JwtPayload }): Promise<{ queued: true }> {
    const { mode, carClass } = QueueBody.parse(body);
    await this.mm.enqueue(req.user.playerId, mode, carClass);
    return { queued: true };
  }

  @Delete("queue")
  async dequeue(@Body() body: unknown, @Req() req: { user: JwtPayload }): Promise<{ ok: true }> {
    const { mode, carClass } = QueueBody.parse(body);
    await this.mm.dequeue(req.user.playerId, mode, carClass);
    return { ok: true };
  }

  /** Client polls this every 2s after queuing; returns the ticket when the worker forms a room. */
  @Get("ticket")
  async pollTicket(@Req() req: { user: JwtPayload }): Promise<MatchTicket | { waiting: true }> {
    const ticket = await this.mm.pollTicket(req.user.playerId);
    return ticket ?? { waiting: true };
  }

  /**
   * Instant bot race — pre-creates a Race row (so rewards work), issues a
   * ticket immediately with 3 AI opponents at the chosen difficulty.
   * No queue, no betting pools opened.
   */
  @Post("bot-race")
  async botRace(@Body() body: unknown, @Req() req: { user: JwtPayload }): Promise<MatchTicket> {
    const { trackId, difficulty } = BotRaceBody.parse(body);
    const playerId = req.user.playerId;
    const { car, handle } = await this.mm.entrantFor(playerId);
    const roomId = `bot_${difficulty}_${crypto.randomUUID()}`;
    const raceId = crypto.randomUUID();

    await this.prisma.race.create({
      data: {
        id: raceId,
        mode: "BOT_RACE",
        trackId,
        serverSeed: roomId,
        startedAt: new Date(),
        participants: {
          create: [{ playerId, carId: car.carId }],
        },
      },
    });

    return this.mm.issueTicket(playerId, roomId, "BOT_RACE", "C", trackId, {
      car,
      handle,
      raceId,
      bots: 3,
      botDifficulty: difficulty,
    });
  }

  /** Dev/offline shortcut — instant ticket, no queue (and no betting pools). */
  @Post("quick")
  async quick(@Body() body: unknown, @Req() req: { user: JwtPayload }): Promise<MatchTicket> {
    const { mode, carClass, trackId } = QueueBody.parse(body);
    const { car, handle } = await this.mm.entrantFor(req.user.playerId);
    return this.mm.issueTicket(
      req.user.playerId,
      `quick_${crypto.randomUUID()}`,
      mode,
      carClass,
      trackId ?? DEFAULT_TRACK_ID,
      // Quick play fills the grid with bots so solo players still get a race
      // (and earn nothing for it — see the reward policy in RacesService).
      { car, handle, bots: 3 },
    );
  }
}
