import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { z } from "zod";
import { FactionsService } from "./factions.service";
import type { JwtPayload } from "../auth/jwt.strategy";

const CreateBody = z.object({
  name: z.string().min(3).max(32),
  tag: z.string().min(2).max(5).regex(/^[A-Za-z0-9]+$/),
});

const PromoteBody = z.object({
  targetPlayerId: z.string().uuid(),
  rank: z.enum(["PROSPECT", "RACER", "OFFICER"]),
});

@Controller("factions")
export class FactionsController {
  constructor(private readonly factions: FactionsService) {}

  @Get()
  list() {
    return this.factions.list();
  }

  @Get("me")
  @UseGuards(AuthGuard("jwt"))
  myFaction(@Req() req: { user: JwtPayload }) {
    return this.factions.myFaction(req.user.playerId);
  }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.factions.get(id);
  }

  @Post()
  @UseGuards(AuthGuard("jwt"))
  async create(@Body() body: unknown, @Req() req: { user: JwtPayload }) {
    const { name, tag } = CreateBody.parse(body);
    const id = await this.factions.create(req.user.playerId, name, tag);
    return { id };
  }

  @Post(":id/join")
  @UseGuards(AuthGuard("jwt"))
  async join(@Param("id", ParseUUIDPipe) id: string, @Req() req: { user: JwtPayload }) {
    await this.factions.join(req.user.playerId, id);
    return { ok: true };
  }

  @Delete("leave")
  @UseGuards(AuthGuard("jwt"))
  async leave(@Req() req: { user: JwtPayload }) {
    await this.factions.leave(req.user.playerId);
    return { ok: true };
  }

  @Put("promote")
  @UseGuards(AuthGuard("jwt"))
  async promote(@Body() body: unknown, @Req() req: { user: JwtPayload }) {
    const { targetPlayerId, rank } = PromoteBody.parse(body);
    await this.factions.promote(req.user.playerId, targetPlayerId, rank);
    return { ok: true };
  }
}
