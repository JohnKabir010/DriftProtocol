import { Injectable } from "@nestjs/common";
import { RaceResultReport } from "@drift/shared";
import { PrismaService } from "../prisma/prisma.service";
import { LedgerService } from "../economy/ledger.service";
import { ReputationService } from "../reputation/reputation.service";
import { FactionsService } from "../factions/factions.service";
import { DistrictsService } from "../districts/districts.service";
import { ReplayVerifierService } from "./replay-verifier.service";
import { BettingService } from "../betting/betting.service";

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
    private readonly factions: FactionsService,
    private readonly districts: DistrictsService,
    private readonly verifier: ReplayVerifierService,
    private readonly betting: BettingService,
  ) {}

  async ingestResult(report: RaceResultReport): Promise<RaceReward[]> {
    // Plausibility gate — throws 400 on impossible values before touching DB.
    this.verifier.verify(report);

    // Idempotency: the report's raceId is the Race primary key. Matchmade
    // races are pre-created by the worker (endedAt null); a race that already
    // has endedAt set was fully processed — acknowledge without re-paying.
    const existing = await this.prisma.race.findUnique({ where: { id: report.raceId } });
    if (existing?.endedAt) return [];

    // Resolve car IDs: the verified ticket's carId comes back in each entry;
    // fall back to the entrant's first garage car for older reports.
    const players = report.entries.map((e) => e.playerId);
    const cars = await this.prisma.car.findMany({
      where: { playerId: { in: players } },
      orderBy: { createdAt: "asc" },
      select: { id: true, playerId: true },
    });
    const carByPlayer = new Map<string, string>();
    for (const car of cars) {
      if (!carByPlayer.has(car.playerId)) carByPlayer.set(car.playerId, car.id);
    }
    const carFor = (e: RaceResultReport["entries"][number]) =>
      e.carId ?? carByPlayer.get(e.playerId) ?? "unknown";

    let race: { id: string };
    if (existing) {
      // Pre-created by the matchmaking worker: close it out and fill results.
      race = await this.prisma.race.update({
        where: { id: report.raceId },
        data: {
          replayHash: report.replayHash,
          startedAt: new Date(report.startedAt),
          endedAt: new Date(report.endedAt),
        },
      });
      for (const e of report.entries) {
        await this.prisma.raceParticipant.upsert({
          where: { raceId_playerId: { raceId: race.id, playerId: e.playerId } },
          update: {
            finishPosition: e.finishPosition,
            finishTimeMs: e.finishTimeMs,
            bestLapMs: e.bestLapMs,
            driftScore: e.driftScore,
            cleanRace: e.cleanRaceBonus,
          },
          create: {
            raceId: race.id,
            playerId: e.playerId,
            carId: carFor(e),
            finishPosition: e.finishPosition,
            finishTimeMs: e.finishTimeMs,
            bestLapMs: e.bestLapMs,
            driftScore: e.driftScore,
            cleanRace: e.cleanRaceBonus,
          },
        });
      }
    } else {
      race = await this.prisma.race.create({
        data: {
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
              carId: carFor(e),
              finishPosition: e.finishPosition,
              finishTimeMs: e.finishTimeMs,
              bestLapMs: e.bestLapMs,
              driftScore: e.driftScore,
              cleanRace: e.cleanRaceBonus,
            })),
          },
        },
      });
    }

    // Anti-farming policy. Entries are humans only (bots never appear):
    //  - 2+ humans                      → full rewards (a real race)
    //  - BOT_RACE hard                  → 50% credits, no rep
    //  - BOT_RACE medium                → 35% credits, no rep
    //  - BOT_RACE easy                  → 20% credits, no rep
    //  - 1 human, matchmade + bots      → 25% credits, no rep — playable, not farmable
    //  - 1 human, quick play            → no rewards; it's practice
    // Positions are overall (bots included), so beating bots still matters.
    const humans = report.entries.length;
    const isMatchmade = !!existing;
    const isBotRace = report.mode === "BOT_RACE";
    type Policy = "FULL" | "BOT_HARD" | "BOT_MEDIUM" | "BOT_EASY" | "REDUCED" | "NONE";
    const policy: Policy =
      humans >= 2 ? "FULL"
      : isBotRace && report.botDifficulty === "hard"   ? "BOT_HARD"
      : isBotRace && report.botDifficulty === "medium" ? "BOT_MEDIUM"
      : isBotRace                                      ? "BOT_EASY"
      : isMatchmade                                    ? "REDUCED"
      : "NONE";

    const rewards: RaceReward[] = [];
    if (policy === "NONE") return rewards;

    // Credit multipliers (× 100 to avoid floats): FULL=100, BOT_HARD=50, BOT_MEDIUM=35, BOT_EASY=20, REDUCED=25
    const MULTIPLIERS: Record<"FULL" | "BOT_HARD" | "BOT_MEDIUM" | "BOT_EASY" | "REDUCED" | "NONE", bigint> = {
      FULL: 100n, BOT_HARD: 50n, BOT_MEDIUM: 35n, BOT_EASY: 20n, REDUCED: 25n, NONE: 0n,
    };

    for (const entry of report.entries) {
      const base = CREDIT_REWARDS[entry.finishPosition - 1] ?? 50n;
      const credits = (base * MULTIPLIERS[policy]) / 100n;

      await this.ledger.post({
        currency: "CREDITS",
        reason: "RACE_REWARD",
        refType: "race",
        refId: race.id,
        idempotencyKey: `race:${report.raceId}:reward:${entry.playerId}`,
        legs: [
          { playerId: entry.playerId, amount: credits },
          { playerId: null, amount: -credits },
        ],
      });

      let repDelta = 0;
      let levelUp = false;
      if (policy === "FULL") {
        ({ repDelta, levelUp } = await this.rep.awardRaceRep(
          entry.playerId,
          race.id,
          entry.finishPosition,
          entry.driftScore,
          entry.cleanRaceBonus,
        ));

        // Faction and district side-effects fire concurrently (non-critical).
        await Promise.allSettled([
          this.factions.awardMemberRep(entry.playerId, repDelta),
          this.districts.awardInfluence(entry.playerId, report.trackId, entry.finishPosition),
        ]);
      }

      rewards.push({ playerId: entry.playerId, credits, repDelta, levelUp });
    }

    // Settle pari-mutuel pools now that finish order is final. Failures are
    // retried by the betting sweeper; rewards above are already committed.
    const rankedPlayerIds = [...report.entries]
      .sort((a, b) => a.finishPosition - b.finishPosition)
      .map((e) => e.playerId);
    await this.betting
      .settleForRace(race.id, rankedPlayerIds)
      .catch((err) => console.error(`[races] pool settlement failed for ${race.id}`, err));

    return rewards;
  }
}
