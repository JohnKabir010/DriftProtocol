import { Body, Controller, Delete, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { z } from "zod";
import { RaceMode, CarClass, MatchTicket } from "@drift/shared";
import { MatchmakingService } from "./matchmaking.service";
import type { JwtPayload } from "../auth/jwt.strategy";

const QueueBody = z.object({ mode: RaceMode, carClass: CarClass });

@Controller("matchmaking")
@UseGuards(AuthGuard("jwt"))
export class MatchmakingController {
  constructor(private readonly mm: MatchmakingService) {}

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

  /** Dev/offline shortcut — instant ticket, no queue. */
  @Post("quick")
  quick(@Body() body: unknown, @Req() req: { user: JwtPayload }): MatchTicket {
    const { mode, carClass } = QueueBody.parse(body);
    return this.mm.issueTicket(req.user.playerId, `quick_${crypto.randomUUID()}`, mode, carClass);
  }
}
