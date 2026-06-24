import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { z } from "zod";
import { MarketplaceService } from "./marketplace.service";
import type { JwtPayload } from "../auth/jwt.strategy";

const ListBody = z.object({
  carId: z.string().uuid(),
  price: z.number().int().min(100),
});

@Controller("market")
export class MarketplaceController {
  constructor(private readonly market: MarketplaceService) {}

  @Get()
  browse(@Query("cursor") cursor?: string) {
    return this.market.browse(40, cursor);
  }

  @Get("mine")
  @UseGuards(AuthGuard("jwt"))
  mine(@Req() req: { user: JwtPayload }) {
    return this.market.myListings(req.user.playerId);
  }

  @Post()
  @UseGuards(AuthGuard("jwt"))
  async list(@Body() body: unknown, @Req() req: { user: JwtPayload }) {
    const { carId, price } = ListBody.parse(body);
    const id = await this.market.list(req.user.playerId, carId, BigInt(price));
    return { id };
  }

  @Post(":id/buy")
  @UseGuards(AuthGuard("jwt"))
  async buy(@Param("id", ParseUUIDPipe) id: string, @Req() req: { user: JwtPayload }) {
    await this.market.buy(req.user.playerId, id);
    return { ok: true };
  }

  @Delete(":id")
  @UseGuards(AuthGuard("jwt"))
  async cancel(@Param("id", ParseUUIDPipe) id: string, @Req() req: { user: JwtPayload }) {
    await this.market.cancel(req.user.playerId, id);
    return { ok: true };
  }
}
