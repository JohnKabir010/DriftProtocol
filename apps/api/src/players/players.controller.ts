import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Controller("players")
export class PlayersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(":id")
  async getProfile(@Param("id", ParseUUIDPipe) id: string) {
    const player = await this.prisma.player.findUnique({
      where: { id },
      select: { id: true, handle: true, level: true, rep: true, repTier: true, avatarUrl: true },
    });
    if (!player) throw new NotFoundException();
    return player;
  }
}
