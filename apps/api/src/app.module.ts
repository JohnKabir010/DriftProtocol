import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { RequestIdMiddleware } from "./common/request-id.middleware";
import { PrismaModule } from "./prisma/prisma.module";
import { InfraModule } from "./infra/infra.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { PlayersModule } from "./players/players.module";
import { GarageModule } from "./garage/garage.module";
import { RacesModule } from "./races/races.module";
import { EconomyModule } from "./economy/economy.module";
import { MatchmakingModule } from "./matchmaking/matchmaking.module";
import { ReputationModule } from "./reputation/reputation.module";
import { FactionsModule } from "./factions/factions.module";
import { DistrictsModule } from "./districts/districts.module";
import { MarketplaceModule } from "./marketplace/marketplace.module";
import { StellarModule } from "./stellar/stellar.module";
import { WalletModule } from "./wallet/wallet.module";
import { TournamentsModule } from "./tournaments/tournaments.module";
import { BettingModule } from "./betting/betting.module";

@Module({
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]), // 120 req/min default
    PrismaModule,
    InfraModule,
    HealthModule,
    StellarModule,
    AuthModule,
    PlayersModule,
    GarageModule,
    RacesModule,
    EconomyModule,
    MatchmakingModule,
    ReputationModule,
    FactionsModule,
    DistrictsModule,
    MarketplaceModule,
    WalletModule,
    TournamentsModule,
    BettingModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
