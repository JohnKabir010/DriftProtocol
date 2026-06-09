import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const XP_PER_LEVEL = 500;

/** Rep delta per finish position. Drifting earns a bonus on top. */
const REP_BY_POSITION = [80, 50, 35, 25, 18, 12, 8, 5];
const REP_PER_1000_DRIFT = 8;
const XP_BY_POSITION = [120, 80, 60, 45, 35, 25, 18, 12];

const TIER_THRESHOLDS = [
  { tier: "LEGEND" as const, min: 10000 },
  { tier: "SYNDICATE" as const, min: 3000 },
  { tier: "UNDERGROUND" as const, min: 800 },
  { tier: "STREET" as const, min: 0 },
];

@Injectable()
export class ReputationService {
  constructor(private readonly prisma: PrismaService) {}

  async awardRaceRep(
    playerId: string,
    raceId: string,
    position: number,
    driftScore: number,
    cleanRace: boolean,
  ): Promise<{ repDelta: number; newRep: number; levelUp: boolean }> {
    const repDelta =
      (REP_BY_POSITION[position - 1] ?? 5) +
      Math.floor(driftScore / 1000) * REP_PER_1000_DRIFT +
      (cleanRace ? 15 : 0);

    const xpDelta = XP_BY_POSITION[position - 1] ?? 12;

    await this.prisma.reputationEvent.create({
      data: { playerId, delta: repDelta, reason: "RACE_FINISH", refId: raceId },
    });

    const player = await this.prisma.player.update({
      where: { id: playerId },
      data: {
        rep: { increment: repDelta },
        xp: { increment: xpDelta },
      },
    });

    const oldLevel = Math.floor((player.xp - xpDelta) / XP_PER_LEVEL) + 1;
    const newLevel = Math.floor(player.xp / XP_PER_LEVEL) + 1;
    const levelUp = newLevel > oldLevel;
    if (levelUp) {
      await this.prisma.player.update({ where: { id: playerId }, data: { level: newLevel } });
    }

    const newTier = TIER_THRESHOLDS.find((t) => player.rep >= t.min)?.tier ?? "STREET";
    if (newTier !== player.repTier) {
      await this.prisma.player.update({ where: { id: playerId }, data: { repTier: newTier } });
    }

    return { repDelta, newRep: player.rep, levelUp };
  }
}
