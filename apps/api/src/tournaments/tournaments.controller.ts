import { timingSafeEqual } from "node:crypto";
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { z } from "zod";
import { TournamentsService } from "./tournaments.service";
import type { JwtPayload } from "../auth/jwt.strategy";

const CreateBody = z.object({
  name: z.string().min(3).max(64),
  mode: z.enum(["SPRINT", "CIRCUIT", "ELIMINATION", "TOURNAMENT"]),
  entryFee: z.number().int().min(0),
  bracketSize: z.number().int().min(4).max(64),
  startsAt: z.string().datetime(),
});

const SettleBody = z.object({
  rankedPlayerIds: z.array(z.string().uuid()).min(1),
});

/**
 * Creating and settling tournaments moves house money — these are operator
 * actions, never player actions. They require the ADMIN_API_TOKEN secret in
 * addition to a player session.
 */
function assertAdmin(token: string | undefined): void {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected || !token) throw new ForbiddenException("admin token required");
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new ForbiddenException("admin token required");
  }
}

@Controller("tournaments")
export class TournamentsController {
  constructor(private readonly tournaments: TournamentsService) {}

  @Get()
  list() {
    return this.tournaments.list();
  }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.tournaments.get(id);
  }

  @Post()
  @UseGuards(AuthGuard("jwt"))
  async create(@Body() body: unknown, @Headers("x-admin-token") adminToken?: string) {
    assertAdmin(adminToken);
    const { name, mode, entryFee, bracketSize, startsAt } = CreateBody.parse(body);
    return this.tournaments.create(name, mode, entryFee, bracketSize, new Date(startsAt));
  }

  @Post(":id/register")
  @UseGuards(AuthGuard("jwt"))
  async register(@Param("id", ParseUUIDPipe) id: string, @Req() req: { user: JwtPayload }) {
    await this.tournaments.register(id, req.user.playerId);
    return { ok: true };
  }

  @Post(":id/settle")
  @UseGuards(AuthGuard("jwt"))
  async settle(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Headers("x-admin-token") adminToken?: string,
  ) {
    assertAdmin(adminToken);
    const { rankedPlayerIds } = SettleBody.parse(body);
    await this.tournaments.settle(id, rankedPlayerIds);
    return { ok: true };
  }
}
