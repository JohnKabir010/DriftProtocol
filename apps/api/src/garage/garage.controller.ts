import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { z } from "zod";
import { UpgradeSlot } from "@drift/shared";
import { GarageService } from "./garage.service";
import type { JwtPayload } from "../auth/jwt.strategy";

const UpgradeBody = z.object({ slot: UpgradeSlot });
const LiveryBody = z.record(z.unknown());

@Controller("garage")
@UseGuards(AuthGuard("jwt"))
export class GarageController {
  constructor(private readonly garage: GarageService) {}

  @Get("cars")
  async listCars(@Req() req: { user: JwtPayload }) {
    return this.garage.listCars(req.user.playerId);
  }

  @Get("cars/:id")
  async getCar(@Param("id", ParseUUIDPipe) id: string, @Req() req: { user: JwtPayload }) {
    return this.garage.getCar(id, req.user.playerId);
  }

  @Post("cars/:id/upgrade")
  async upgrade(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Req() req: { user: JwtPayload },
  ) {
    const { slot } = UpgradeBody.parse(body);
    await this.garage.purchaseUpgrade(id, req.user.playerId, slot);
    return { ok: true };
  }

  @Post("cars/:id/livery")
  async livery(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
    @Req() req: { user: JwtPayload },
  ) {
    await this.garage.updateLivery(id, req.user.playerId, LiveryBody.parse(body));
    return { ok: true };
  }
}
