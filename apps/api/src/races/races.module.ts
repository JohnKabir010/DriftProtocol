import { Module } from "@nestjs/common";
import { EconomyModule } from "../economy/economy.module";
import { GarageModule } from "../garage/garage.module";
import { ReputationModule } from "../reputation/reputation.module";
import { RacesController } from "./races.controller";
import { RacesService } from "./races.service";

@Module({
  imports: [EconomyModule, GarageModule, ReputationModule],
  controllers: [RacesController],
  providers: [RacesService],
})
export class RacesModule {}
