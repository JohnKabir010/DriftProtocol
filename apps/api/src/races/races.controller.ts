import { timingSafeEqual } from "node:crypto";
import { Body, Controller, ForbiddenException, Headers, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { RaceResultReportSchema } from "@drift/shared";
import { RacesService } from "./races.service";
import { BettingService } from "../betting/betting.service";

function assertServiceToken(token: string | undefined): void {
  const expected = process.env.REALTIME_SERVICE_TOKEN;
  const a = Buffer.from(token ?? "");
  const b = Buffer.from(expected ?? "");
  if (!token || !expected || a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new ForbiddenException("realtime service token required");
  }
}

@Controller("internal/races")
export class RacesController {
  constructor(
    private readonly races: RacesService,
    private readonly betting: BettingService,
  ) {}

  @Post("results")
  async ingest(@Body() body: unknown, @Headers("x-service-token") token?: string) {
    assertServiceToken(token);
    const report = RaceResultReportSchema.parse(body);
    const rewards = await this.races.ingestResult(report);
    return { ok: true, rewards };
  }

  /** Realtime room calls this at the green light — no bets once racing starts. */
  @Post(":raceId/lock-pools")
  async lockPools(
    @Param("raceId", ParseUUIDPipe) raceId: string,
    @Headers("x-service-token") token?: string,
  ) {
    assertServiceToken(token);
    await this.betting.lockPools(raceId);
    return { ok: true };
  }
}
