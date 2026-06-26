import { Controller, Get } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { PrismaService } from "../prisma/prisma.service";

/** Public counters for the landing page live-stats bar. */
@Controller("stats")
@SkipThrottle()
export class StatsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async stats() {
    const [totalPlayers, liveRaces, contestedDistricts] = await Promise.all([
      this.prisma.player.count(),
      this.prisma.race.count({ where: { endedAt: null } }),
      this.prisma.districtEpoch.count({
        where: { endsAt: { gte: new Date() }, controllingFactionId: { not: null } },
      }),
    ]);
    return { totalPlayers, liveRaces, contestedDistricts };
  }
}
