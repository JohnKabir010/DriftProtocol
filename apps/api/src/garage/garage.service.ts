import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CAR_CATALOG, STARTER_CAR_KEY, UpgradeSlot, upgradeCost } from "@drift/shared";
import { PrismaService } from "../prisma/prisma.service";
import { LedgerService } from "../economy/ledger.service";

@Injectable()
export class GarageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  /** Provision the starter car for a brand-new player. Idempotent. */
  async ensureStarterCar(playerId: string): Promise<void> {
    const existing = await this.prisma.car.findFirst({ where: { playerId } });
    if (existing) return;
    await this.prisma.car.create({
      data: {
        playerId,
        modelKey: STARTER_CAR_KEY,
        carClass: "D",
        livery: { paint: "#101622", underglow: "#004455", decals: [] },
      },
    });
  }

  async listCars(playerId: string) {
    return this.prisma.car.findMany({
      where: { playerId },
      include: { upgrades: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async getCar(carId: string, playerId: string) {
    const car = await this.prisma.car.findUnique({
      where: { id: carId },
      include: { upgrades: true },
    });
    if (!car || car.playerId !== playerId) throw new NotFoundException();
    return car;
  }

  /** Purchase the next tier of an upgrade slot. Credits deducted atomically. */
  async purchaseUpgrade(carId: string, playerId: string, slot: UpgradeSlot): Promise<void> {
    const car = await this.getCar(carId, playerId);
    const existing = car.upgrades.find((u) => u.slot === slot);
    const currentTier = existing?.tier ?? 0;
    if (currentTier >= 5) throw new BadRequestException("already maxed");

    const catalog = CAR_CATALOG[car.modelKey];
    if (!catalog) throw new BadRequestException("unknown car model");

    const targetTier = currentTier + 1;
    const cost = upgradeCost(slot as UpgradeSlot, targetTier);

    await this.ledger.post({
      currency: "CREDITS",
      reason: "UPGRADE_PURCHASE",
      refType: "car",
      refId: carId,
      idempotencyKey: `upgrade:${carId}:${slot}:${targetTier}`,
      legs: [
        { playerId, amount: -cost },
        { playerId: null, amount: cost },
      ],
    });

    await this.prisma.carUpgrade.upsert({
      where: { carId_slot: { carId, slot } },
      update: { tier: targetTier },
      create: { carId, slot, tier: targetTier },
    });
  }

  async updateLivery(carId: string, playerId: string, livery: Record<string, unknown>): Promise<void> {
    await this.getCar(carId, playerId);
    await this.prisma.car.update({ where: { id: carId }, data: { livery: livery as object } });
  }
}
