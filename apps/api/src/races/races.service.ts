import { Injectable } from "@nestjs/common";
import { RaceResultReport } from "@drift/shared";
import { PrismaService } from "../prisma/prisma.service";
import { LedgerService } from "../economy/ledger.service";

/** Credits payout table by finish position; server-config in production. */
const REWARDS: bigint[] = [1000n, 600n, 400n, 250n, 150n, 100n, 50n, 50n];

@Injectable()
export class RacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  /**
   * Ingest an authoritative result from the realtime fleet (service-token
   * authenticated — players can never call this). Persists the race, posts
   * rewards, and leaves `validated=false` so high-stakes consequences hold
   * until async anti-cheat re-simulation clears the replay.
   */
  async ingestResult(report: RaceResultReport): Promise<void> {
    await this.prisma.race.upsert({
      where: { id: report.raceId },
      update: {},
      create: {
        id: report.raceId,
        mode: report.mode,
        trackId: report.trackId,
        serverSeed: report.serverSeed,
        replayHash: report.replayHash,
        startedAt: new Date(report.startedAt),
        endedAt: new Date(report.endedAt),
        participants: {
          create: report.entries.map((e) => ({
            playerId: e.playerId,
            carId: "unknown", // populated from the room ticket in the full flow
            finishPosition: e.finishPosition,
            finishTimeMs: e.finishTimeMs,
            bestLapMs: e.bestLapMs,
            driftScore: e.driftScore,
            cleanRace: e.cleanRaceBonus,
          })),
        },
      },
    });

    for (const entry of report.entries) {
      const reward = REWARDS[entry.finishPosition - 1] ?? 0n;
      if (reward === 0n) continue;
      await this.ledger.post({
        currency: "CREDITS",
        reason: "RACE_REWARD",
        refType: "race",
        refId: report.raceId,
        idempotencyKey: `race:${report.raceId}:reward:${entry.playerId}`,
        legs: [
          { playerId: entry.playerId, amount: reward },
          { playerId: null, amount: -reward }, // house faucet leg
        ],
      });
    }
  }
}
