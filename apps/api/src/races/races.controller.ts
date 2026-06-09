import { Body, Controller, ForbiddenException, Headers, Post } from "@nestjs/common";
import { RaceResultReportSchema } from "@drift/shared";
import { RacesService } from "./races.service";

@Controller("internal/races")
export class RacesController {
  constructor(private readonly races: RacesService) {}

  /** Internal endpoint — realtime fleet only, authenticated by service token. */
  @Post("results")
  async ingest(@Body() body: unknown, @Headers("x-service-token") token?: string): Promise<{ ok: true }> {
    if (!token || token !== process.env.REALTIME_SERVICE_TOKEN) {
      throw new ForbiddenException("realtime service token required");
    }
    const report = RaceResultReportSchema.parse(body);
    await this.races.ingestResult(report);
    return { ok: true };
  }
}
