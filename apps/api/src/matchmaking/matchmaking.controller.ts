import { Body, Controller, Post, UseGuards, Req } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { z } from "zod";
import { RaceMode, CarClass, MatchTicket } from "@drift/shared";
import { MatchmakingService } from "./matchmaking.service";
import type { JwtPayload } from "../auth/jwt.strategy";

const EnqueueSchema = z.object({ mode: RaceMode, carClass: CarClass });

@Controller("matchmaking")
@UseGuards(AuthGuard("jwt"))
export class MatchmakingController {
  constructor(private readonly mm: MatchmakingService) {}

  @Post("queue")
  async queue(@Body() body: unknown, @Req() req: { user: JwtPayload }): Promise<{ queued: true }> {
    const { mode, carClass } = EnqueueSchema.parse(body);
    await this.mm.enqueue(req.user.playerId, mode, carClass);
    return { queued: true };
  }

  /** Dev shortcut: skip the queue and get a ticket for a fresh quick-race room. */
  @Post("quick")
  quick(@Body() body: unknown, @Req() req: { user: JwtPayload }): MatchTicket {
    const { mode, carClass } = EnqueueSchema.parse(body);
    return this.mm.issueTicket(req.user.playerId, `quick_${crypto.randomUUID()}`, mode, carClass);
  }
}
