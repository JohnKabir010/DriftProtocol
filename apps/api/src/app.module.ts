import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { PlayersModule } from "./players/players.module";
import { GarageModule } from "./garage/garage.module";
import { RacesModule } from "./races/races.module";
import { EconomyModule } from "./economy/economy.module";
import { MatchmakingModule } from "./matchmaking/matchmaking.module";
import { ReputationModule } from "./reputation/reputation.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    PlayersModule,
    GarageModule,
    RacesModule,
    EconomyModule,
    MatchmakingModule,
    ReputationModule,
  ],
})
export class AppModule {}
