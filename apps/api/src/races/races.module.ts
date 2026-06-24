import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { EconomyModule } from "../economy/economy.module";
import { GarageModule } from "../garage/garage.module";
import { ReputationModule } from "../reputation/reputation.module";
import { FactionsModule } from "../factions/factions.module";
import { DistrictsModule } from "../districts/districts.module";
import { BettingModule } from "../betting/betting.module";
import { RacesController } from "./races.controller";
import { RacesService } from "./races.service";
import { ReplayVerifierService } from "./replay-verifier.service";

@Module({
  imports: [PrismaModule, EconomyModule, GarageModule, ReputationModule, FactionsModule, DistrictsModule, BettingModule],
  controllers: [RacesController],
  providers: [RacesService, ReplayVerifierService],
})
export class RacesModule {}
