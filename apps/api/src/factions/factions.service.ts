import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { LedgerService } from "../economy/ledger.service";

const CREATE_COST = 500n; // Credits to found a faction
const MIN_REP_TO_CREATE = 800; // UNDERGROUND tier threshold
const MAX_MEMBERS = 50;

@Injectable()
export class FactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  async list() {
    const factions = await this.prisma.faction.findMany({
      include: { _count: { select: { members: true } } },
      orderBy: { rep: "desc" },
    });
    return factions.map((f) => ({ ...f, memberCount: f._count.members }));
  }

  async get(factionId: string) {
    const faction = await this.prisma.faction.findUnique({
      where: { id: factionId },
      include: {
        members: {
          include: {
            player: { select: { handle: true, level: true, rep: true, repTier: true } },
          },
          orderBy: [{ rank: "asc" }, { joinedAt: "asc" }],
        },
      },
    });
    if (!faction) throw new NotFoundException("faction not found");
    return faction;
  }

  async create(playerId: string, name: string, tag: string): Promise<string> {
    const player = await this.prisma.player.findUniqueOrThrow({ where: { id: playerId } });
    if (player.rep < MIN_REP_TO_CREATE) {
      throw new ForbiddenException(`Need ${MIN_REP_TO_CREATE} rep to found a faction (UNDERGROUND tier)`);
    }
    if (await this.prisma.factionMember.findUnique({ where: { playerId } })) {
      throw new BadRequestException("Leave your current faction first");
    }

    const cleanName = name.trim();
    const cleanTag = tag.toUpperCase().trim();
    const taken = await this.prisma.faction.findFirst({
      where: { OR: [{ name: cleanName }, { tag: cleanTag }] },
    });
    if (taken) throw new BadRequestException("Faction name or tag already taken");

    await this.ledger.post({
      currency: "CREDITS",
      reason: "FACTION_CREATE",
      idempotencyKey: `faction-create:${playerId}:${cleanName}`,
      legs: [
        { playerId, amount: -CREATE_COST },
        { playerId: null, amount: CREATE_COST },
      ],
    });

    try {
      const faction = await this.prisma.faction.create({
        data: {
          name: cleanName,
          tag: cleanTag,
          members: { create: { playerId, rank: "BOSS" } },
        },
      });
      return faction.id;
    } catch (err) {
      // Lost a race on the unique name/tag — refund the founding fee.
      await this.ledger.post({
        currency: "CREDITS",
        reason: "FACTION_CREATE_REFUND",
        idempotencyKey: `faction-create-refund:${playerId}:${cleanName}`,
        legs: [
          { playerId, amount: CREATE_COST },
          { playerId: null, amount: -CREATE_COST },
        ],
      });
      throw new BadRequestException("Faction name or tag already taken");
    }
  }

  async join(playerId: string, factionId: string): Promise<void> {
    if (await this.prisma.factionMember.findUnique({ where: { playerId } })) {
      throw new BadRequestException("Already in a faction — leave first");
    }
    const faction = await this.prisma.faction.findUnique({
      where: { id: factionId },
      include: { _count: { select: { members: true } } },
    });
    if (!faction) throw new NotFoundException();
    if (faction._count.members >= MAX_MEMBERS) throw new BadRequestException("Faction is full");

    await this.prisma.factionMember.create({ data: { playerId, factionId, rank: "PROSPECT" } });
  }

  async leave(playerId: string): Promise<void> {
    const member = await this.prisma.factionMember.findUnique({ where: { playerId } });
    if (!member) throw new BadRequestException("Not in a faction");
    if (member.rank === "BOSS") {
      const others = await this.prisma.factionMember.count({ where: { factionId: member.factionId } });
      if (others > 1) throw new BadRequestException("Promote another officer to Boss before leaving");
      // Solo boss — disband the faction.
      await this.prisma.faction.delete({ where: { id: member.factionId } });
      return;
    }
    await this.prisma.factionMember.delete({ where: { playerId } });
  }

  async promote(requesterId: string, targetPlayerId: string, newRank: string): Promise<void> {
    const requester = await this.prisma.factionMember.findUnique({ where: { playerId: requesterId } });
    if (!requester || !["BOSS", "OFFICER"].includes(requester.rank)) {
      throw new ForbiddenException("Only bosses and officers can promote");
    }
    const target = await this.prisma.factionMember.findUnique({ where: { playerId: targetPlayerId } });
    if (!target || target.factionId !== requester.factionId) throw new NotFoundException();
    const allowed = ["PROSPECT", "RACER", "OFFICER"];
    if (!allowed.includes(newRank)) throw new BadRequestException("Invalid rank");
    await this.prisma.factionMember.update({
      where: { playerId: targetPlayerId },
      data: { rank: newRank },
    });
  }

  /** Award faction rep when a member races — called from RacesService. */
  async awardMemberRep(playerId: string, repDelta: number): Promise<void> {
    const member = await this.prisma.factionMember.findUnique({ where: { playerId } });
    if (!member) return;
    // Faction rep = weighted sum of member contributions, decayed weekly in the epoch worker.
    await this.prisma.faction.update({
      where: { id: member.factionId },
      data: { rep: { increment: Math.floor(repDelta * 0.3) } },
    });
  }

  async myFaction(playerId: string) {
    const member = await this.prisma.factionMember.findUnique({
      where: { playerId },
      include: { faction: true },
    });
    return member ?? null;
  }
}
