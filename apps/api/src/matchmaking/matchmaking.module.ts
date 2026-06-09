import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { MatchmakingController } from "./matchmaking.controller";
import { MatchmakingService } from "./matchmaking.service";
import { MatchmakingWorker } from "./matchmaking.worker";

@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_ACCESS_SECRET })],
  controllers: [MatchmakingController],
  providers: [MatchmakingService, MatchmakingWorker],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
