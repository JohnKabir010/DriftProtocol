import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { PlayersModule } from "./players/players.module";
import { RacesModule } from "./races/races.module";
import { EconomyModule } from "./economy/economy.module";
import { MatchmakingModule } from "./matchmaking/matchmaking.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    PlayersModule,
    RacesModule,
    EconomyModule,
    MatchmakingModule,
  ],
})
export class AppModule {}
