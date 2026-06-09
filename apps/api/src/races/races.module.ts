import { Module } from "@nestjs/common";
import { EconomyModule } from "../economy/economy.module";
import { RacesController } from "./races.controller";
import { RacesService } from "./races.service";

@Module({
  imports: [EconomyModule],
  controllers: [RacesController],
  providers: [RacesService],
})
export class RacesModule {}
