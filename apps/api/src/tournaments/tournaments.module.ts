import { Module } from "@nestjs/common";
import { TournamentsService } from "./tournaments.service";
import { TournamentsController } from "./tournaments.controller";
import { EconomyModule } from "../economy/economy.module";

@Module({
  imports: [EconomyModule],
  providers: [TournamentsService],
  controllers: [TournamentsController],
})
export class TournamentsModule {}
