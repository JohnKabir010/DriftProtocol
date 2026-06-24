import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { GarageModule } from "../garage/garage.module";
import { BettingModule } from "../betting/betting.module";
import { PrismaModule } from "../prisma/prisma.module";
import { MatchmakingController } from "./matchmaking.controller";
import { MatchmakingService } from "./matchmaking.service";
import { MatchmakingWorker } from "./matchmaking.worker";

@Module({
  imports: [
    JwtModule.register({ secret: process.env.JWT_ACCESS_SECRET }),
    GarageModule,
    BettingModule,
    PrismaModule,
  ],
  controllers: [MatchmakingController],
  providers: [MatchmakingService, MatchmakingWorker],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
