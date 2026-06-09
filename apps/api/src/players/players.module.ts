import { Module } from "@nestjs/common";
import { EconomyModule } from "../economy/economy.module";
import { PlayersController } from "./players.controller";

@Module({
  imports: [EconomyModule],
  controllers: [PlayersController],
})
export class PlayersModule {}
