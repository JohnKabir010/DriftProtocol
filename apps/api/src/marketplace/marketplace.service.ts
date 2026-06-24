import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { LedgerService } from "../economy/ledger.service";
import { CAR_CATALOG } from "@drift/shared";

const MARKET_RAKE_BPS = 250; // 2.5% goes to house
const MIN_PRICE = 100n;

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  async browse(limit = 40, cursor?: string) {
    const rows = await this.prisma.marketListing.findMany({
      where: { status: "ACTIVE", currency: "CREDITS" },
      orderBy: { createdAt: "desc" },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        seller: { select: { handle: true, repTier: true } },
      },
    });

    // Enrich CAR listings with catalog metadata.
    const enriched = await Promise.all(
      rows.map(async (r) => {
        let carModel: (typeof CAR_CATALOG)[string] | null = null;
        if (r.assetType === "CAR") {
          const car = await this.prisma.car.findUnique({ where: { id: r.assetRef } });
          carModel = car ? (CAR_CATALOG[car.modelKey] ?? null) : null;
        }
        return { ...r, price: r.price.toString(), carModel };
      }),
    );
    return enriched;
  }

  async list(sellerId: string, carId: string, price: bigint): Promise<string> {
    if (price < MIN_PRICE) throw new BadRequestException(`Minimum price is ₵${MIN_PRICE}`);

    const car = await this.prisma.car.findUnique({ where: { id: carId } });
    if (!car || car.playerId !== sellerId) throw new ForbiddenException("Not your car");

    const existing = await this.prisma.marketListing.findFirst({
      where: { assetRef: carId, status: "ACTIVE" },
    });
    if (existing) throw new BadRequestException("Already listed");

    const listing = await this.prisma.marketListing.create({
      data: {
        sellerId,
        assetType: "CAR",
        assetRef: carId,
        currency: "CREDITS",
        price,
        status: "ACTIVE",
      },
    });
    return listing.id;
  }

  async buy(buyerId: string, listingId: string): Promise<void> {
    const listing = await this.prisma.marketListing.findUnique({ where: { id: listingId } });
    if (!listing || listing.status !== "ACTIVE") throw new NotFoundException("Listing not found or closed");
    if (listing.sellerId === buyerId) throw new BadRequestException("Cannot buy your own listing");

    // Claim the listing first with a status-guarded update. This is the lock:
    // of N concurrent buyers (or a racing cancel), exactly one transition wins.
    const claimed = await this.prisma.marketListing.updateMany({
      where: { id: listingId, status: "ACTIVE" },
      data: { status: "FILLED" },
    });
    if (claimed.count === 0) throw new NotFoundException("Listing not found or closed");

    const reopen = () =>
      this.prisma.marketListing.updateMany({
        where: { id: listingId, status: "FILLED" },
        data: { status: "ACTIVE" },
      });

    // The asset must still belong to the seller (it may have moved since listing).
    if (listing.assetType === "CAR") {
      const car = await this.prisma.car.findUnique({ where: { id: listing.assetRef } });
      if (!car || car.playerId !== listing.sellerId) {
        await this.prisma.marketListing.updateMany({
          where: { id: listingId, status: "FILLED" },
          data: { status: "CANCELLED" },
        });
        throw new BadRequestException("Listing is stale — seller no longer owns this asset");
      }
    }

    const price = listing.price;
    const rake = (price * BigInt(MARKET_RAKE_BPS)) / 10_000n;
    const sellerGets = price - rake;

    try {
      await this.ledger.post({
        currency: "CREDITS",
        reason: "MARKET_BUY",
        refType: "listing",
        refId: listingId,
        idempotencyKey: `market-buy:${listingId}:${buyerId}`,
        legs: [
          { playerId: buyerId, amount: -price },
          { playerId: listing.sellerId, amount: sellerGets },
          { playerId: null, amount: rake },
        ],
      });
    } catch (err) {
      await reopen(); // payment failed (e.g. insufficient credits) — relist
      throw err;
    }

    if (listing.assetType === "CAR") {
      // Guarded transfer: only moves the car if the seller still holds it.
      const moved = await this.prisma.car.updateMany({
        where: { id: listing.assetRef, playerId: listing.sellerId },
        data: { playerId: buyerId },
      });
      if (moved.count === 0) {
        throw new BadRequestException(
          "Asset transfer failed after payment — contact support (payment is journaled)",
        );
      }
    }
  }

  async cancel(sellerId: string, listingId: string): Promise<void> {
    const listing = await this.prisma.marketListing.findUnique({ where: { id: listingId } });
    if (!listing) throw new NotFoundException();
    if (listing.sellerId !== sellerId) throw new ForbiddenException();
    // Status-guarded so a cancel racing a buy can't clobber a FILLED listing.
    const updated = await this.prisma.marketListing.updateMany({
      where: { id: listingId, status: "ACTIVE" },
      data: { status: "CANCELLED" },
    });
    if (updated.count === 0) throw new BadRequestException("Already closed");
  }

  async myListings(sellerId: string) {
    const rows = await this.prisma.marketListing.findMany({
      where: { sellerId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      include: { seller: { select: { handle: true, repTier: true } } },
    });

    return Promise.all(
      rows.map(async (r) => {
        let carModel: (typeof CAR_CATALOG)[string] | null = null;
        if (r.assetType === "CAR") {
          const car = await this.prisma.car.findUnique({ where: { id: r.assetRef } });
          carModel = car ? (CAR_CATALOG[car.modelKey] ?? null) : null;
        }
        return { ...r, price: r.price.toString(), carModel };
      }),
    );
  }
}
