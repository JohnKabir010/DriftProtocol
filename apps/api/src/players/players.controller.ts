import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../prisma/prisma.service";
import { LedgerService } from "../economy/ledger.service";
import type { JwtPayload } from "../auth/jwt.strategy";

@Controller("players")
export class PlayersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  /** Authenticated player's own profile + live credit balance. */
  @Get("me")
  @UseGuards(AuthGuard("jwt"))
  async me(@Req() req: { user: JwtPayload }) {
    return this.buildProfile(req.user.playerId);
  }

  @Get(":id")
  async getProfile(@Param("id", ParseUUIDPipe) id: string) {
    return this.buildProfile(id);
  }

  private async buildProfile(playerId: string) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: { id: true, handle: true, level: true, xp: true, rep: true, repTier: true, avatarUrl: true },
    });
    if (!player) throw new NotFoundException();
    const credits = await this.ledger.balanceOf(playerId, "CREDITS");
    return { ...player, credits: credits.toString() };
  }
}
