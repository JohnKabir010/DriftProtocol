import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { LedgerService } from "../economy/ledger.service";
import { StellarService } from "../stellar/stellar.service";
import { ChainTxService } from "../stellar/chain-tx.service";

// Prize distribution in basis points of the total Credits pool per finish
// position. Integer math only — float splits produce unbalanced journals.
const PRIZE_SPLIT_BPS = [5000n, 3000n, 1500n, 500n];
// USDC bonus from house treasury per winner (top 3).
const USDC_PRIZES = ["10.0000000", "5.0000000", "2.0000000"];
// House treasury player ID (null = house account in ledger).
const HOUSE_PLAYER_ID = null;

@Injectable()
export class TournamentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly stellar: StellarService,
    private readonly chainTx: ChainTxService,
  ) {}

  async list() {
    return this.prisma.tournament.findMany({
      orderBy: { startsAt: "desc" },
      take: 20,
    });
  }

  async get(id: string) {
    const t = await this.prisma.tournament.findUnique({ where: { id } });
    if (!t) throw new NotFoundException();
    const registrants = await this.registrants(id);
    return { ...t, entryFee: t.entryFee.toString(), registrants };
  }

  async create(name: string, mode: string, entryFee: number, bracketSize: number, startsAt: Date) {
    if (bracketSize < 4 || bracketSize > 64) throw new BadRequestException("bracketSize must be 4-64");
    return this.prisma.tournament.create({
      data: {
        name,
        mode: mode as any,
        currency: "CREDITS",
        entryFee: BigInt(entryFee),
        bracketSize,
        startsAt,
        status: "REGISTRATION",
      },
    });
  }

  /** Player IDs that paid the entry fee — the ledger is the registration record. */
  private async registrants(tournamentId: string): Promise<string[]> {
    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        reason: "TOURNAMENT_ENTRY",
        refType: "tournament",
        refId: tournamentId,
        playerId: { not: null },
        amount: { lt: 0n },
      },
      select: { playerId: true },
    });
    return [...new Set(entries.map((e) => e.playerId!))];
  }

  async register(tournamentId: string, playerId: string): Promise<void> {
    const t = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!t) throw new NotFoundException("Tournament not found");
    if (t.status !== "REGISTRATION") throw new BadRequestException("Registration closed");

    const registered = await this.registrants(tournamentId);
    if (registered.includes(playerId)) throw new BadRequestException("Already registered");
    if (registered.length >= t.bracketSize) throw new BadRequestException("Bracket is full");

    await this.ledger.post({
      currency: "CREDITS",
      reason: "TOURNAMENT_ENTRY",
      refType: "tournament",
      refId: tournamentId,
      idempotencyKey: `tournament-entry:${tournamentId}:${playerId}`,
      legs: [
        { playerId, amount: -t.entryFee },
        { playerId: HOUSE_PLAYER_ID, amount: t.entryFee },
      ],
    });
  }

  /**
   * Settle a completed tournament (admin/service only — enforced at the
   * controller). The ranking must be a full ordering of the players who
   * actually paid the entry fee; the pool is derived from those entries, so
   * the caller cannot inflate it.
   */
  async settle(tournamentId: string, rankedPlayerIds: string[]): Promise<void> {
    const t = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!t) throw new NotFoundException();

    const registered = await this.registrants(tournamentId);
    if (registered.length === 0) throw new BadRequestException("No paid registrations");

    const rankedSet = new Set(rankedPlayerIds);
    if (rankedSet.size !== rankedPlayerIds.length) {
      throw new BadRequestException("Duplicate player in ranking");
    }
    if (
      rankedPlayerIds.length !== registered.length ||
      !registered.every((p) => rankedSet.has(p))
    ) {
      throw new BadRequestException("Ranking must order exactly the registered players");
    }

    // Status-guarded transition: exactly one settle call wins.
    const claimed = await this.prisma.tournament.updateMany({
      where: { id: tournamentId, NOT: { status: "SETTLED" } },
      data: { status: "SETTLED" },
    });
    if (claimed.count === 0) throw new BadRequestException("Already settled");

    const poolCredits = t.entryFee * BigInt(registered.length);

    // Integer bps payouts; the house leg mirrors the exact payout sum so the
    // journal always balances. The bps remainder stays with the house as rake.
    const legs: Array<{ playerId: string | null; amount: bigint }> = [];
    let paidOut = 0n;
    for (let i = 0; i < rankedPlayerIds.length && i < PRIZE_SPLIT_BPS.length; i++) {
      const amount = (poolCredits * PRIZE_SPLIT_BPS[i]!) / 10_000n;
      if (amount <= 0n) continue;
      legs.push({ playerId: rankedPlayerIds[i]!, amount });
      paidOut += amount;
    }
    legs.unshift({ playerId: HOUSE_PLAYER_ID, amount: -paidOut });

    try {
      await this.ledger.post({
        currency: "CREDITS",
        reason: "TOURNAMENT_PAYOUT",
        refType: "tournament",
        refId: tournamentId,
        idempotencyKey: `tournament-payout:${tournamentId}`,
        legs,
      });
    } catch (err) {
      // Roll the status back so settlement can be retried after the fault.
      await this.prisma.tournament.updateMany({
        where: { id: tournamentId, status: "SETTLED" },
        data: { status: "RUNNING" },
      });
      throw err;
    }

    // Send USDC from house treasury to top finishers (best-effort, non-blocking).
    void this.disperseUsdcPrizes(tournamentId, rankedPlayerIds);
  }

  private async disperseUsdcPrizes(tournamentId: string, rankedPlayerIds: string[]) {
    const houseKeypair = this.stellar.getHouseKeypair();
    if (!houseKeypair) return; // House treasury not configured — Credits-only payout.

    for (let i = 0; i < Math.min(3, rankedPlayerIds.length); i++) {
      const playerId = rankedPlayerIds[i]!;
      const amount = USDC_PRIZES[i]!;
      const recipient = this.stellar.deriveCustodialKeypair(playerId);

      // Journaled + idempotent: a repeat settle returns the existing outcome,
      // an indeterminate submit is resolved by the chain reconciler, and a
      // definitive rejection stays FAILED for operator review.
      await this.chainTx.submitUsdcPayment({
        kind: "TOURNAMENT_PAYOUT",
        idempotencyKey: `usdc-prize:${tournamentId}:pos-${i + 1}`,
        from: houseKeypair,
        to: recipient.publicKey(),
        amount,
        memo: `drift:prize:${i + 1}`,
        payload: { tournamentId, playerId, position: i + 1, amount },
      });
    }
  }
}
