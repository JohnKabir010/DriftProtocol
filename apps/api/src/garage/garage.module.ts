import { Module } from "@nestjs/common";
import { EconomyModule } from "../economy/economy.module";
import { GarageController } from "./garage.controller";
import { GarageService } from "./garage.service";

@Module({
  imports: [EconomyModule],
  controllers: [GarageController],
  providers: [GarageService],
  exports: [GarageService],
})
export class GarageModule {}
