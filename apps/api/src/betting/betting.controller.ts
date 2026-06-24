import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { z } from "zod";
import { BettingService } from "./betting.service";
import type { JwtPayload } from "../auth/jwt.strategy";

const PlaceBetBody = z.object({
  selectionId: z.string().uuid(),
  stake: z.number().int().positive(),
});

@Controller("betting")
export class BettingController {
  constructor(private readonly betting: BettingService) {}

  /** Races currently open for betting, with live per-entrant pool totals. */
  @Get("open")
  listOpen() {
    return this.betting.listOpen();
  }

  @Get("mine")
  @UseGuards(AuthGuard("jwt"))
  myBets(@Req() req: { user: JwtPayload }) {
    return this.betting.myBets(req.user.playerId);
  }

  @Post("pools/:poolId/bets")
  @UseGuards(AuthGuard("jwt"))
  async placeBet(
    @Param("poolId", ParseUUIDPipe) poolId: string,
    @Body() body: unknown,
    @Req() req: { user: JwtPayload },
  ) {
    const { selectionId, stake } = PlaceBetBody.parse(body);
    const betId = await this.betting.placeBet(req.user.playerId, poolId, selectionId, BigInt(stake));
    return { ok: true, betId };
  }
}
