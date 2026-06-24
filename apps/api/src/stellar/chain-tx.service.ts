import { Injectable, Logger } from "@nestjs/common";
import type { Keypair } from "@stellar/stellar-sdk";
import { PrismaService } from "../prisma/prisma.service";
import { StellarService } from "./stellar.service";

export type PaymentOutcome =
  | { status: "CONFIRMED"; txHash: string }
  /** Submission outcome unknown (timeout/network) — the reconciler resolves it. */
  | { status: "SETTLING"; txHash: string }
  /** Definitively rejected by the network; safe to retry with a fresh tx. */
  | { status: "FAILED"; txHash: string; error: string };

/** Horizon transaction-level result codes from a 400 rejection, if present. */
export function extractResultCodes(err: unknown): string | null {
  const extras = (
    err as { response?: { data?: { extras?: { result_codes?: unknown } } } }
  )?.response?.data?.extras;
  if (!extras?.result_codes) return null;
  try {
    return JSON.stringify(extras.result_codes);
  } catch {
    return "unparseable result_codes";
  }
}

/**
 * The ONLY path for value-moving Stellar submissions. Every payment is
 * journaled in ChainTx with its signed XDR + locally computed hash BEFORE it
 * touches Horizon, so no outcome is ever ambiguous:
 *
 *   PENDING    envelope built and persisted, not yet handed to Horizon
 *   SUBMITTED  handed to Horizon, outcome unknown — NEVER treated as failed
 *   CONFIRMED  seen on-chain (submit response or reconciler lookup)
 *   FAILED     definitively rejected, or timebounds expired without inclusion
 *
 * A FAILED row may be retried under the same idempotency key (the row is
 * re-armed with a fresh envelope); PENDING/SUBMITTED rows block duplicates.
 */
@Injectable()
export class ChainTxService {
  private readonly logger = new Logger(ChainTxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stellar: StellarService,
  ) {}

  async submitUsdcPayment(params: {
    kind: string;
    idempotencyKey: string;
    from: Keypair;
    to: string;
    amount: string;
    memo?: string;
    /** Business context persisted alongside the envelope (playerId etc.). */
    payload: Record<string, unknown>;
  }): Promise<PaymentOutcome> {
    const existing = await this.prisma.chainTx.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });
    if (existing) {
      if (existing.status === "CONFIRMED") {
        return { status: "CONFIRMED", txHash: existing.txHash! };
      }
      if (existing.status === "PENDING" || existing.status === "SUBMITTED") {
        // In flight — do not double-submit; the reconciler owns it now.
        return { status: "SETTLING", txHash: existing.txHash ?? "" };
      }
      // FAILED — fall through and re-arm the same row with a fresh envelope.
    }

    const built = await this.stellar.buildUsdcPayment(
      params.from,
      params.to,
      params.amount,
      params.memo,
    );
    const payload = {
      ...params.payload,
      xdr: built.xdr,
      expiresAt: built.expiresAt.toISOString(),
    };

    const row = existing
      ? await this.prisma.chainTx.update({
          where: { id: existing.id },
          data: { status: "PENDING", txHash: built.hash, payload, error: null },
        })
      : await this.prisma.chainTx.create({
          data: {
            kind: params.kind,
            status: "PENDING",
            txHash: built.hash,
            payload,
            idempotencyKey: params.idempotencyKey,
          },
        });

    // SUBMITTED before the network call: a crash mid-submit leaves a row the
    // reconciler can resolve by hash, instead of a payment nobody owns.
    await this.prisma.chainTx.update({ where: { id: row.id }, data: { status: "SUBMITTED" } });

    try {
      await this.stellar.submitXdr(built.xdr);
      await this.prisma.chainTx.update({ where: { id: row.id }, data: { status: "CONFIRMED" } });
      return { status: "CONFIRMED", txHash: built.hash };
    } catch (err) {
      return this.resolveSubmitError(row.id, built.hash, err);
    }
  }

  /**
   * A submit threw. Before trusting any error, ask Horizon whether the tx is
   * actually on-chain (covers tx_bad_seq after a prior delivery, races with
   * the reconciler, and lying proxies). Only a clean result-code rejection
   * with no on-chain record is FAILED; everything else stays SUBMITTED.
   */
  private async resolveSubmitError(
    rowId: string,
    hash: string,
    err: unknown,
  ): Promise<PaymentOutcome> {
    const lookup = await this.stellar
      .getTransactionStatus(hash)
      .catch(() => ({ status: "not_found" as const }));

    if (lookup.status === "confirmed") {
      await this.prisma.chainTx.update({ where: { id: rowId }, data: { status: "CONFIRMED" } });
      return { status: "CONFIRMED", txHash: hash };
    }

    const codes = extractResultCodes(err);
    if (codes) {
      await this.prisma.chainTx.update({
        where: { id: rowId },
        data: { status: "FAILED", error: codes },
      });
      this.logger.warn(`chain tx ${hash} rejected: ${codes}`);
      return { status: "FAILED", txHash: hash, error: codes };
    }

    // Timeout / 5xx / connection reset: outcome genuinely unknown.
    this.logger.warn(`chain tx ${hash} outcome unknown (${String(err)}) — left SUBMITTED`);
    return { status: "SETTLING", txHash: hash };
  }

  /** True if this player already has a withdrawal that is not yet resolved. */
  async hasUnsettledWithdrawal(playerId: string): Promise<boolean> {
    const open = await this.prisma.chainTx.findFirst({
      where: {
        kind: "USDC_WITHDRAWAL",
        status: { in: ["PENDING", "SUBMITTED"] },
        payload: { path: ["playerId"], equals: playerId },
      },
      select: { id: true },
    });
    return open !== null;
  }
}
