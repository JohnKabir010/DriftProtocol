import { Injectable } from "@nestjs/common";
import { RaceResultReport } from "@drift/shared";
import { PrismaService } from "../prisma/prisma.service";
import { LedgerService } from "../economy/ledger.service";
import { ReputationService } from "../reputation/reputation.service";

/** Credits payout by finish position. All economy dials are server-config in prod. */
const CREDIT_REWARDS: bigint[] = [1200n, 750n, 500n, 320n, 200n, 130n, 70n, 50n];

export interface RaceReward {
  playerId: string;
  credits: bigint;
  repDelta: number;
  levelUp: boolean;
}

@Injectable()
export class RacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly rep: ReputationService,
  ) {}

  async ingestResult(report: RaceResultReport): Promise<RaceReward[]> {
    const raceId = await this.prisma.$transaction(async (tx) => {
      const race = await tx.race.create({
        data: {
          mode: report.mode,
          trackId: report.trackId,
          serverSeed: report.serverSeed,
          replayHash: report.replayHash,
          startedAt: new Date(report.startedAt),
          endedAt: new Date(report.endedAt),
          participants: {
            create: report.entries.map((e) => ({
              playerId: e.playerId,
              carId: "00000000-0000-0000-0000-000000000000",
              finishPosition: e.finishPosition,
              finishTimeMs: e.finishTimeMs,
              bestLapMs: e.bestLapMs,
              driftScore: e.driftScore,
              cleanRace: e.cleanRaceBonus,
            })),
          },
        },
      });
      return race.id;
    });

    const rewards: RaceReward[] = [];
    for (const entry of report.entries) {
      const credits = CREDIT_REWARDS[entry.finishPosition - 1] ?? 50n;
      await this.ledger.post({
        currency: "CREDITS",
        reason: "RACE_REWARD",
        refType: "race",
        refId: raceId,
        idempotencyKey: `race:${report.raceId}:reward:${entry.playerId}`,
        legs: [
          { playerId: entry.playerId, amount: credits },
          { playerId: null, amount: -credits },
        ],
      });

      const { repDelta, levelUp } = await this.rep.awardRaceRep(
        entry.playerId,
        raceId,
        entry.finishPosition,
        entry.driftScore,
        entry.cleanRaceBonus,
      );
      rewards.push({ playerId: entry.playerId, credits, repDelta, levelUp });
    }
    return rewards;
  }
}
