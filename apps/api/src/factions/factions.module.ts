import { Module } from "@nestjs/common";
import { EconomyModule } from "../economy/economy.module";
import { FactionsController } from "./factions.controller";
import { FactionsService } from "./factions.service";

@Module({
  imports: [EconomyModule],
  controllers: [FactionsController],
  providers: [FactionsService],
  exports: [FactionsService],
})
export class FactionsModule {}
