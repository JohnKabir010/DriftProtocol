import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../infra/redis.service";
import { StellarService } from "./stellar.service";

const SWEEP_INTERVAL_MS = 30_000;
/** Don't touch fresh PENDING rows — the originating request still owns them. */
const PENDING_GRACE_MS = 60_000;
/** Ledger-close buffer past the tx's own timebounds before declaring it dead. */
const EXPIRY_BUFFER_MS = 60_000;
/** Rows with no hash and no envelope can never be resolved on-chain. */
const ORPHAN_TIMEOUT_MS = 60 * 60_000;
const BATCH = 50;

/**
 * Resolves every PENDING/SUBMITTED ChainTx to a terminal state by asking
 * Horizon for the truth. The safety argument:
 *
 *  - found successful        → CONFIRMED (payment happened, exactly once)
 *  - found failed            → FAILED (consumed a sequence number, moved no value)
 *  - not found AND timebounds
 *    expired (+ buffer)      → FAILED — Stellar guarantees a tx whose maxTime
 *                              has passed can never be included, so a retry
 *                              cannot double-pay
 *  - not found, not expired  → leave for the next sweep
 *
 * Without this worker, a Horizon timeout forces a guess between "swallow the
 * player's money" and "risk paying twice". With it, nobody guesses.
 *
 * Single-instance by assumption (like the betting sweeper) — needs leader
 * election before the API scales horizontally. Sweeps are idempotent, so an
 * accidental second instance is wasteful, not dangerous.
 */
@Injectable()
export class ChainReconcilerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChainReconcilerService.name);
  private timer?: NodeJS.Timeout;
  private sweeping = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stellar: StellarService,
    private readonly redis: RedisService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.sweepSafely(), SWEEP_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async sweepSafely(): Promise<void> {
    if (this.sweeping) return; // a slow Horizon must not stack sweeps
    this.sweeping = true;
    try {
      // Leader lock: one replica reconciles; sweeps are idempotent regardless.
      if (await this.redis.tryLock("chain-reconcile", SWEEP_INTERVAL_MS - 5_000)) {
        await this.sweep();
      }
    } catch (err) {
      this.logger.error("reconciliation sweep failed", err);
    } finally {
      this.sweeping = false;
    }
  }

  async sweep(): Promise<void> {
    const rows = await this.prisma.chainTx.findMany({
      where: { status: { in: ["PENDING", "SUBMITTED"] } },
      orderBy: { createdAt: "asc" },
      take: BATCH,
    });

    const now = Date.now();
    for (const row of rows) {
      // A fresh PENDING row is still owned by its originating request.
      if (row.status === "PENDING" && now - row.createdAt.getTime() < PENDING_GRACE_MS) continue;

      try {
        await this.resolve(row, now);
      } catch (err) {
        // Horizon hiccup on this row — next sweep will see it again.
        this.logger.warn(`could not resolve chain tx ${row.id}: ${String(err)}`);
      }
    }
  }

  private async resolve(
    row: { id: string; txHash: string | null; payload: unknown; createdAt: Date },
    now: number,
  ): Promise<void> {
    if (!row.txHash) {
      // Pre-worker legacy rows or corrupt writes: nothing to look up.
      if (now - row.createdAt.getTime() > ORPHAN_TIMEOUT_MS) {
        await this.markFailed(row.id, "no tx hash recorded — unresolvable");
      }
      return;
    }

    const lookup = await this.stellar.getTransactionStatus(row.txHash);

    if (lookup.status === "confirmed") {
      await this.prisma.chainTx.update({
        where: { id: row.id },
        data: { status: "CONFIRMED", error: null },
      });
      this.logger.log(`reconciled ${row.txHash} → CONFIRMED`);
      return;
    }

    if (lookup.status === "failed") {
      await this.markFailed(row.id, `on-chain failure: ${lookup.resultCodes ?? "unknown"}`);
      return;
    }

    // Not found: only terminal once the envelope's own timebounds are past.
    const expiresAt = this.expiryOf(row.payload);
    if (expiresAt !== null) {
      if (now > expiresAt.getTime() + EXPIRY_BUFFER_MS) {
        await this.markFailed(row.id, "timebounds expired before inclusion — never executed");
      }
      return;
    }
    // No recorded expiry (legacy row): fall back to a generous timeout.
    if (now - row.createdAt.getTime() > ORPHAN_TIMEOUT_MS) {
      await this.markFailed(row.id, "not found on-chain after 1h, no timebounds recorded");
    }
  }

  private expiryOf(payload: unknown): Date | null {
    const raw = (payload as { expiresAt?: unknown })?.expiresAt;
    if (typeof raw !== "string") return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  private async markFailed(id: string, error: string): Promise<void> {
    await this.prisma.chainTx.update({ where: { id }, data: { status: "FAILED", error } });
    this.logger.warn(`reconciled chain tx ${id} → FAILED (${error})`);
  }
}
