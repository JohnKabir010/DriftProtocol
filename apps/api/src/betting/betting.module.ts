import { Module } from "@nestjs/common";
import { EconomyModule } from "../economy/economy.module";
import { BettingController } from "./betting.controller";
import { BettingService } from "./betting.service";

@Module({
  imports: [EconomyModule],
  controllers: [BettingController],
  providers: [BettingService],
  exports: [BettingService],
})
export class BettingModule {}
