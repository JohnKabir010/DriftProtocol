import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/** Points awarded per race finish in a district. */
const INFLUENCE_BY_POSITION = [120, 75, 50, 35, 25, 18, 12, 8];

/** District→track mapping (static catalog; tracks are data). */
const TRACK_DISTRICT: Record<string, string> = {
  "neon-row-circuit": "neon-row",
  "docklands-sprint": "docklands",
  "docklands-circuit": "docklands",
  "stacks-drift-bowl": "the-stacks",
  "stacks-circuit": "the-stacks",
  "skyline-loop": "skyline-loop",
};

@Injectable()
export class DistrictsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const districts = await this.prisma.district.findMany({
      include: {
        epochs: {
          where: { endsAt: { gte: new Date() } },
          orderBy: { epochNumber: "desc" },
          take: 1,
          include: { controllingFaction: { select: { id: true, name: true, tag: true } } },
        },
      },
    });

    return districts.map((d) => {
      const epoch = d.epochs[0] ?? null;
      const influence = (epoch?.influence ?? {}) as Record<string, number>;
      const sorted = Object.entries(influence).sort(([, a], [, b]) => b - a).slice(0, 5);
      return {
        id: d.id,
        key: d.key,
        name: d.name,
        controller: epoch?.controllingFaction ?? null,
        epochEndsAt: epoch?.endsAt ?? null,
        topInfluence: sorted,
        totalInfluence: Object.values(influence).reduce((a, b) => a + b, 0),
      };
    });
  }

  async get(key: string) {
    const district = await this.prisma.district.findUniqueOrThrow({
      where: { key },
      include: {
        epochs: {
          orderBy: { epochNumber: "desc" },
          take: 5,
          include: { controllingFaction: { select: { id: true, name: true, tag: true } } },
        },
      },
    });
    const current = district.epochs[0];
    return {
      ...district,
      influence: (current?.influence ?? {}) as Record<string, number>,
      epochEndsAt: current?.endsAt ?? null,
      controller: current?.controllingFaction ?? null,
    };
  }

  /**
   * Award district influence to a faction member after a race.
   * Called from RacesService; no-ops if the track isn't in a district or the
   * player isn't in a faction.
   */
  async awardInfluence(
    playerId: string,
    trackId: string,
    position: number,
  ): Promise<void> {
    const districtKey = TRACK_DISTRICT[trackId];
    if (!districtKey) return;

    const member = await this.prisma.factionMember.findUnique({ where: { playerId } });
    if (!member) return;

    const faction = await this.prisma.faction.findUnique({
      where: { id: member.factionId },
      select: { name: true },
    });
    if (!faction) return;

    const district = await this.prisma.district.findUnique({ where: { key: districtKey } });
    if (!district) return;

    const delta = INFLUENCE_BY_POSITION[position - 1] ?? 8;

    // Serializable read-modify-write with retry: two races finishing in the
    // same district at once must not lose each other's influence.
    for (let attempt = 0; ; attempt++) {
      try {
        await this.prisma.$transaction(
          async (tx) => {
            const epoch = await tx.districtEpoch.findFirst({
              where: { districtId: district.id, endsAt: { gte: new Date() } },
              orderBy: { epochNumber: "desc" },
            });
            if (!epoch) return;

            const influence = (epoch.influence as Record<string, number>) ?? {};
            influence[member.factionId] = (influence[member.factionId] ?? 0) + delta;
            const topFactionId =
              Object.entries(influence).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

            await tx.districtEpoch.update({
              where: { id: epoch.id },
              data: { influence, controllingFactionId: topFactionId },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        return;
      } catch (err) {
        const retriable =
          err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
        if (!retriable || attempt >= 3) throw err;
        await new Promise((r) => setTimeout(r, 15 * (attempt + 1)));
      }
    }
  }
}
