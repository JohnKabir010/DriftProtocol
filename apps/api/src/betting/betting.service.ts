import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { LedgerService } from "../economy/ledger.service";
import { RedisService } from "../infra/redis.service";

const MIN_STAKE = 50n;
const MAX_STAKE = 50_000n;
/** Betting window after a race is formed; the room also hard-locks at green light. */
const BET_WINDOW_MS = 45_000;
/** Pools for races that never report a result are refunded after this. */
const STALE_POOL_MS = 20 * 60_000;
const SWEEP_INTERVAL_MS = 60_000;

/**
 * Pari-mutuel betting on matchmade races, Credits only (the dual-economy
 * firewall keeps USDC out of wagering). All stakes flow into the pool via the
 * double-entry ledger; payouts are proportional shares of the post-rake pool.
 * No odds are quoted — the pool IS the odds.
 */
@Injectable()
export class BettingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BettingService.name);
  private sweepTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly redis: RedisService,
  ) {}

  onModuleInit(): void {
    this.sweepTimer = setInterval(() => {
      void this.sweepAsLeader();
    }, SWEEP_INTERVAL_MS);
    this.sweepTimer.unref();
  }

  /** Leader-locked: with N API replicas, exactly one runs each sweep. */
  private async sweepAsLeader(): Promise<void> {
    try {
      if (!(await this.redis.tryLock("betting-sweep", SWEEP_INTERVAL_MS - 5_000))) return;
      await this.voidStalePools();
    } catch (err) {
      this.logger.error("stale-pool sweep failed", err);
    }
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  /** Open WIN + PODIUM pools for a freshly formed race. */
  async openPoolsForRace(raceId: string): Promise<void> {
    const closesAt = new Date(Date.now() + BET_WINDOW_MS);
    await this.prisma.betPool.createMany({
      data: [
        { raceId, kind: "WIN", currency: "CREDITS", status: "OPEN", closesAt },
        { raceId, kind: "PODIUM", currency: "CREDITS", status: "OPEN", closesAt },
      ],
    });
  }

  /** Open races with bettable pools, plus per-selection totals for live odds. */
  async listOpen() {
    const pools = await this.prisma.betPool.findMany({
      where: { status: "OPEN", closesAt: { gt: new Date() } },
      include: {
        race: {
          include: {
            participants: {
              include: { player: { select: { handle: true, repTier: true } } },
            },
          },
        },
        bets: { select: { selectionId: true, stake: true } },
      },
      orderBy: { closesAt: "asc" },
    });

    return pools.map((pool) => {
      const totals = new Map<string, bigint>();
      let total = 0n;
      for (const bet of pool.bets) {
        totals.set(bet.selectionId, (totals.get(bet.selectionId) ?? 0n) + bet.stake);
        total += bet.stake;
      }
      return {
        id: pool.id,
        raceId: pool.raceId,
        kind: pool.kind,
        rakeBps: pool.rakeBps,
        closesAt: pool.closesAt,
        trackId: pool.race.trackId,
        mode: pool.race.mode,
        totalStaked: total.toString(),
        entrants: pool.race.participants.map((p) => ({
          playerId: p.playerId,
          handle: p.player.handle,
          repTier: p.player.repTier,
          staked: (totals.get(p.playerId) ?? 0n).toString(),
        })),
      };
    });
  }

  async myBets(playerId: string) {
    const bets = await this.prisma.bet.findMany({
      where: { playerId },
      include: { pool: { select: { kind: true, status: true, raceId: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return bets.map((b) => ({
      id: b.id,
      poolId: b.poolId,
      raceId: b.pool.raceId,
      kind: b.pool.kind,
      poolStatus: b.pool.status,
      selectionId: b.selectionId,
      stake: b.stake.toString(),
      payout: b.payout?.toString() ?? null,
      createdAt: b.createdAt,
    }));
  }

  async placeBet(playerId: string, poolId: string, selectionId: string, stake: bigint): Promise<string> {
    if (stake < MIN_STAKE || stake > MAX_STAKE) {
      throw new BadRequestException(`Stake must be between ₵${MIN_STAKE} and ₵${MAX_STAKE}`);
    }

    const pool = await this.prisma.betPool.findUnique({
      where: { id: poolId },
      include: { race: { include: { participants: { select: { playerId: true } } } } },
    });
    if (!pool) throw new NotFoundException("Pool not found");
    if (pool.status !== "OPEN" || pool.closesAt <= new Date()) {
      throw new BadRequestException("Betting is closed for this race");
    }

    const entrants = new Set(pool.race.participants.map((p) => p.playerId));
    if (!entrants.has(selectionId)) throw new BadRequestException("Selection is not racing");
    // Match-fixing guard: entrants cannot bet in their own race at all.
    if (entrants.has(playerId)) throw new BadRequestException("Racers cannot bet on their own race");

    // Stake first (ledger enforces balance), then record the bet; refund if
    // the record fails so money and bets can never disagree.
    const betId = crypto.randomUUID();
    await this.ledger.post({
      currency: "CREDITS",
      reason: "BET_STAKE",
      refType: "bet",
      refId: betId,
      idempotencyKey: `bet-stake:${betId}`,
      legs: [
        { playerId, amount: -stake },
        { playerId: null, amount: stake },
      ],
    });

    try {
      await this.prisma.bet.create({
        data: { id: betId, poolId, playerId, selectionId, stake },
      });
      return betId;
    } catch (err) {
      await this.ledger.post({
        currency: "CREDITS",
        reason: "BET_STAKE_REFUND",
        refType: "bet",
        refId: betId,
        idempotencyKey: `bet-stake-refund:${betId}`,
        legs: [
          { playerId, amount: stake },
          { playerId: null, amount: -stake },
        ],
      });
      throw err;
    }
  }

  /** Hard-lock all pools for a race (called by the realtime room at green light). */
  async lockPools(raceId: string): Promise<void> {
    await this.prisma.betPool.updateMany({
      where: { raceId, status: "OPEN" },
      data: { status: "LOCKED" },
    });
  }

  /**
   * Settle every pool of a finished race. Called from race-result ingestion,
   * idempotent per pool via the status guard + ledger idempotency keys.
   * `rankedPlayerIds` is finish order, winner first.
   */
  async settleForRace(raceId: string, rankedPlayerIds: string[]): Promise<void> {
    const pools = await this.prisma.betPool.findMany({
      where: { raceId, status: { in: ["OPEN", "LOCKED"] } },
      include: { bets: true },
    });

    for (const pool of pools) {
      const winners = new Set(
        pool.kind === "PODIUM" ? rankedPlayerIds.slice(0, 3) : rankedPlayerIds.slice(0, 1),
      );
      try {
        await this.settlePool(pool.id, pool.rakeBps, pool.bets, winners);
      } catch (err) {
        this.logger.error(`settle failed for pool ${pool.id}`, err);
      }
    }
  }

  private async settlePool(
    poolId: string,
    rakeBps: number,
    bets: Array<{ id: string; playerId: string; selectionId: string; stake: bigint }>,
    winners: Set<string>,
  ): Promise<void> {
    // Claim the pool: exactly one settle/void wins against concurrent calls.
    const claimed = await this.prisma.betPool.updateMany({
      where: { id: poolId, status: { in: ["OPEN", "LOCKED"] } },
      data: { status: "SETTLED" },
    });
    if (claimed.count === 0) return;

    if (bets.length === 0) return; // nothing staked — settled empty

    const total = bets.reduce((acc, b) => acc + b.stake, 0n);
    const winningBets = bets.filter((b) => winners.has(b.selectionId));
    const winningStake = winningBets.reduce((acc, b) => acc + b.stake, 0n);

    if (winningStake === 0n) {
      // Nobody backed a winner — refund every stake rather than house-keep.
      await this.prisma.betPool.update({ where: { id: poolId }, data: { status: "VOIDED" } });
      await this.refundBets(poolId, bets);
      return;
    }

    const rake = (total * BigInt(rakeBps)) / 10_000n;
    const distributable = total - rake;

    // Proportional integer payouts; the flooring remainder stays with the house.
    const payouts = winningBets
      .map((b) => ({ bet: b, amount: (distributable * b.stake) / winningStake }))
      .filter((p) => p.amount > 0n);
    const paidOut = payouts.reduce((acc, p) => acc + p.amount, 0n);

    try {
      await this.ledger.post({
        currency: "CREDITS",
        reason: "BET_PAYOUT",
        refType: "pool",
        refId: poolId,
        idempotencyKey: `bet-settle:${poolId}`,
        legs: [
          { playerId: null, amount: -paidOut },
          ...payouts.map((p) => ({ playerId: p.bet.playerId, amount: p.amount })),
        ],
      });
    } catch (err) {
      // Re-open for retry (next sweep or repeated ingest call).
      await this.prisma.betPool.updateMany({
        where: { id: poolId, status: "SETTLED" },
        data: { status: "LOCKED" },
      });
      throw err;
    }

    const payoutByBet = new Map(payouts.map((p) => [p.bet.id, p.amount]));
    for (const bet of bets) {
      await this.prisma.bet.update({
        where: { id: bet.id },
        data: { payout: payoutByBet.get(bet.id) ?? 0n },
      });
    }
  }

  /** Refund every stake of a pool (no winner backed, or the race never finished). */
  private async refundBets(
    poolId: string,
    bets: Array<{ id: string; playerId: string; stake: bigint }>,
  ): Promise<void> {
    if (bets.length === 0) return;
    const total = bets.reduce((acc, b) => acc + b.stake, 0n);
    await this.ledger.post({
      currency: "CREDITS",
      reason: "BET_REFUND",
      refType: "pool",
      refId: poolId,
      idempotencyKey: `bet-void:${poolId}`,
      legs: [
        { playerId: null, amount: -total },
        ...bets.map((b) => ({ playerId: b.playerId, amount: b.stake })),
      ],
    });
    for (const bet of bets) {
      await this.prisma.bet.update({ where: { id: bet.id }, data: { payout: bet.stake } });
    }
  }

  /**
   * Periodic reconciliation:
   *  1) settle pools of races that finished but whose settlement faulted
   *     (finish order is recovered from the stored participant rows);
   *  2) refund pools whose race never produced a result (room crash).
   */
  async voidStalePools(): Promise<void> {
    const unsettled = await this.prisma.betPool.findMany({
      where: { status: { in: ["OPEN", "LOCKED"] }, race: { endedAt: { not: null } } },
      include: { race: { include: { participants: true } }, bets: true },
    });
    for (const pool of unsettled) {
      const ranked = pool.race.participants
        .filter((p) => p.finishPosition !== null)
        .sort((a, b) => a.finishPosition! - b.finishPosition!)
        .map((p) => p.playerId);
      if (ranked.length === 0) continue;
      const winners = new Set(pool.kind === "PODIUM" ? ranked.slice(0, 3) : ranked.slice(0, 1));
      await this.settlePool(pool.id, pool.rakeBps, pool.bets, winners).catch((err) =>
        this.logger.error(`sweeper settle failed for pool ${pool.id}`, err),
      );
    }

    const cutoff = new Date(Date.now() - STALE_POOL_MS);
    const stale = await this.prisma.betPool.findMany({
      where: {
        status: { in: ["OPEN", "LOCKED"] },
        createdAt: { lt: cutoff },
        race: { endedAt: null },
      },
      include: { bets: true },
    });

    for (const pool of stale) {
      const claimed = await this.prisma.betPool.updateMany({
        where: { id: pool.id, status: { in: ["OPEN", "LOCKED"] } },
        data: { status: "VOIDED" },
      });
      if (claimed.count === 0) continue;
      this.logger.warn(`voiding stale pool ${pool.id} (race ${pool.raceId} never finished)`);
      await this.refundBets(pool.id, pool.bets);
    }
  }
}
