import { BadRequestException, Injectable } from "@nestjs/common";
import { Currency, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface LedgerLeg {
  /** null = the house/system side of the entry. */
  playerId: string | null;
  amount: bigint; // signed minor units
}

/**
 * Double-entry Credits/USDC ledger. Every economic action posts a balanced
 * journal (legs sum to zero) atomically. Balances are derived, never stored —
 * which makes the economy auditable and makes duping a constraint violation
 * rather than a bug class.
 */
@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async post(params: {
    currency: Currency;
    reason: string;
    legs: LedgerLeg[];
    idempotencyKey: string;
    refType?: string;
    refId?: string;
  }): Promise<void> {
    const sum = params.legs.reduce((acc, leg) => acc + leg.amount, 0n);
    if (sum !== 0n) {
      throw new BadRequestException(`Unbalanced journal for ${params.reason}: net ${sum}`);
    }

    const journalId = crypto.randomUUID();
    // Serializable isolation makes the overdraft check race-proof: two
    // concurrent spends from the same balance cannot both read the old sum.
    // Serialization aborts (P2034) are retried with backoff.
    for (let attempt = 0; ; attempt++) {
      try {
        await this.prisma.$transaction(
          async (tx) => {
            // Reject overdrafts before posting: a player leg may not take a
            // balance negative. House legs are exempt (they absorb float).
            for (const leg of params.legs) {
              if (leg.playerId && leg.amount < 0n) {
                const balance = await this.balanceOf(leg.playerId, params.currency, tx);
                if (balance + leg.amount < 0n) {
                  throw new BadRequestException("Insufficient balance");
                }
              }
            }
            await tx.ledgerEntry.createMany({
              data: params.legs.map((leg, i) => ({
                playerId: leg.playerId,
                currency: params.currency,
                amount: leg.amount,
                journalId,
                reason: params.reason,
                refType: params.refType,
                refId: params.refId,
                // One idempotency key per journal; legs disambiguated by index.
                idempotencyKey: `${params.idempotencyKey}:${i}`,
              })),
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        return;
      } catch (err) {
        // Unique violation on idempotencyKey ⇒ this journal already posted; treat as success.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2034" &&
          attempt < 3
        ) {
          await new Promise((r) => setTimeout(r, 20 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
  }

  async balanceOf(playerId: string, currency: Currency, tx?: Prisma.TransactionClient): Promise<bigint> {
    const client = tx ?? this.prisma;
    const agg = await client.ledgerEntry.aggregate({
      where: { playerId, currency },
      _sum: { amount: true },
    });
    return agg._sum.amount ?? 0n;
  }
}
