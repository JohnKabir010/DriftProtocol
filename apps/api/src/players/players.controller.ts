import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { SkipThrottle } from "@nestjs/throttler";
import { PrismaService } from "../prisma/prisma.service";
import { LedgerService } from "../economy/ledger.service";
import type { JwtPayload } from "../auth/jwt.strategy";

// Dev-mode boost amounts: lets testers unlock all feature gates in one call.
const DEV_CREDITS_BONUS = 50_000n;
const DEV_REP_BONUS = 2000; // enough to hit UNDERGROUND (800+) for factions
const DEV_XP_BONUS = 5000;

@Controller("players")
export class PlayersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  /** Top 20 players by rep — public, no auth required. */
  @Get("leaderboard")
  async leaderboard() {
    const players = await this.prisma.player.findMany({
      orderBy: { rep: "desc" },
      take: 20,
      select: {
        id: true,
        handle: true,
        level: true,
        rep: true,
        repTier: true,
        _count: { select: { raceEntries: { where: { finishPosition: 1 } } } },
      },
    });
    return players.map((p, i) => ({
      rank: i + 1,
      id: p.id,
      handle: p.handle,
      level: p.level,
      rep: p.rep,
      tier: p.repTier,
      wins: p._count.raceEntries,
    }));
  }

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

  /**
   * Dev/testnet only — grants 50 000 Credits + 2 000 rep + 5 000 XP so every
   * feature gate (factions, marketplace, tournaments) can be tested without grinding.
   * Returns 403 in production.
   */
  @Post("me/dev-boost")
  @UseGuards(AuthGuard("jwt"))
  @SkipThrottle()
  async devBoost(@Req() req: { user: JwtPayload }) {
    if (process.env["NODE_ENV"] === "production") {
      throw new ForbiddenException("Dev boost not available in production");
    }

    const playerId = req.user.playerId;

    // Grant credits via ledger
    await this.ledger.post({
      currency: "CREDITS",
      reason: "DEV_BOOST",
      refType: "dev",
      refId: playerId,
      idempotencyKey: `dev-boost:credits:${playerId}:${Date.now()}`,
      legs: [
        { playerId, amount: DEV_CREDITS_BONUS },
        { playerId: null, amount: -DEV_CREDITS_BONUS },
      ],
    });

    // Grant rep + XP directly
    await this.prisma.player.update({
      where: { id: playerId },
      data: {
        rep: { increment: DEV_REP_BONUS },
        xp: { increment: DEV_XP_BONUS },
        repTier: "UNDERGROUND", // ensure faction creation gate is met
      },
    });

    return this.buildProfile(playerId);
  }

  private async buildProfile(playerId: string) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        handle: true,
        level: true,
        xp: true,
        rep: true,
        repTier: true,
        avatarUrl: true,
        user: { select: { authProvider: true } },
      },
    });
    if (!player) throw new NotFoundException();
    const credits = await this.ledger.balanceOf(playerId, "CREDITS");
    const { user, ...rest } = player;
    return { ...rest, credits: credits.toString(), authProvider: user.authProvider };
  }
}
