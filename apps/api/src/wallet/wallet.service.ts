import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StellarService } from "../stellar/stellar.service";
import { ChainTxService } from "../stellar/chain-tx.service";
import { LedgerService } from "../economy/ledger.service";
import { RedisService } from "../infra/redis.service";
import { Keypair } from "@stellar/stellar-sdk";

const WITHDRAWAL_FEE_BPS = 100; // 1%
const MIN_WITHDRAWAL_USDC = "1.0000000";
const CHALLENGE_TTL_MS = 5 * 60_000;

@Injectable()
export class WalletService {
  /**
   * Per-player in-flight withdrawal locks (this process). Cross-instance
   * safety comes from the DB-side hasUnsettledWithdrawal guard.
   */
  private readonly withdrawLocks = new Map<string, Promise<unknown>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly stellar: StellarService,
    private readonly chainTx: ChainTxService,
    private readonly ledger: LedgerService,
    private readonly redis: RedisService,
  ) {}

  /** Remove a linked wallet by ID (ownership validated via userId). */
  async unlinkWallet(walletLinkId: string, userId: string): Promise<void> {
    await this.prisma.walletLink.deleteMany({ where: { id: walletLinkId, userId } });
  }

  /** Get custodial wallet info. Creates the account on-chain lazily. */
  async getWallet(playerId: string) {
    const player = await this.prisma.player.findUniqueOrThrow({ where: { id: playerId } });
    const keypair = this.stellar.deriveCustodialKeypair(playerId);
    const publicKey = keypair.publicKey();

    // Ensure account exists and has USDC trustline.
    await this.stellar.ensureUsdcTrustline(keypair);

    // Store public key on player record so other modules can reference it.
    if (player.custodialAccountId !== publicKey) {
      await this.prisma.player.update({
        where: { id: playerId },
        data: { custodialAccountId: publicKey },
      });
    }

    const [usdcBalance, xlmBalance, linkedWallets] = await Promise.all([
      this.stellar.usdcBalance(publicKey),
      this.stellar.xlmBalance(publicKey),
      this.prisma.walletLink.findMany({ where: { userId: player.userId } }),
    ]);

    return {
      custodialAddress: publicKey,
      usdcBalance,
      xlmBalance,
      linkedWallets: linkedWallets.map((w) => ({
        id: w.id,
        publicKey: w.publicKey,
        verifiedAt: w.verifiedAt,
      })),
    };
  }

  /** Issue a challenge hex for Freighter wallet-link signing. One per user, short-lived. */
  async getChallenge(userId: string) {
    const challenge = this.stellar.generateChallenge();
    // Redis with TTL: one-time use, survives deploys, shared across replicas.
    await this.redis.putOnce(`wallet-challenge:${userId}`, challenge, CHALLENGE_TTL_MS);
    return { challenge };
  }

  /** Link an external Freighter wallet after verifying the signed challenge. */
  async linkWallet(userId: string, publicKey: string, challenge: string, signature: string) {
    // Validate it's a real Stellar public key.
    try { Keypair.fromPublicKey(publicKey); }
    catch { throw new BadRequestException("Invalid Stellar public key"); }

    // The challenge must be the one WE issued to THIS user, unexpired, used once.
    // Without this, any historical signature by the key could be replayed.
    // takeOnce is an atomic GETDEL — a second link attempt sees nothing.
    const issued = await this.redis.takeOnce(`wallet-challenge:${userId}`);
    if (!issued || issued !== challenge) {
      throw new ForbiddenException("Challenge expired or not issued — request a new one");
    }

    if (!this.stellar.verifyChallenge(publicKey, challenge, signature)) {
      throw new ForbiddenException("Signature verification failed");
    }

    const existing = await this.prisma.walletLink.findUnique({ where: { publicKey } });
    if (existing && existing.userId !== userId) throw new BadRequestException("Key already linked to another account");

    return this.prisma.walletLink.upsert({
      where: { publicKey },
      create: { userId, publicKey, verifiedAt: new Date() },
      update: { verifiedAt: new Date() },
    });
  }

  /**
   * Withdraw USDC from custodial account to an external Stellar address.
   * Serialized per player: concurrent requests run one at a time so the
   * balance check can't be raced (Stellar sequence numbers would also reject
   * the second tx, but we fail it cleanly here instead).
   */
  async withdraw(
    playerId: string,
    toAddress: string,
    amount: string,
  ): Promise<{ txHash: string; status: "CONFIRMED" | "SETTLING" }> {
    const prev = this.withdrawLocks.get(playerId) ?? Promise.resolve();
    const run = prev
      .catch(() => undefined)
      .then(() => this.doWithdraw(playerId, toAddress, amount));
    this.withdrawLocks.set(playerId, run);
    run.finally(() => {
      if (this.withdrawLocks.get(playerId) === run) this.withdrawLocks.delete(playerId);
    });
    return run;
  }

  private async doWithdraw(
    playerId: string,
    toAddress: string,
    amount: string,
  ): Promise<{ txHash: string; status: "CONFIRMED" | "SETTLING" }> {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < parseFloat(MIN_WITHDRAWAL_USDC)) {
      throw new BadRequestException(`Minimum withdrawal is ${MIN_WITHDRAWAL_USDC} USDC`);
    }

    try { Keypair.fromPublicKey(toAddress); }
    catch { throw new BadRequestException("Invalid destination address"); }

    // One withdrawal at a time per player: while a prior tx is PENDING or
    // SUBMITTED its outcome is unknown, so a new one could double-spend.
    // The reconciler resolves it within ~2 minutes either way.
    if (await this.chainTx.hasUnsettledWithdrawal(playerId)) {
      throw new BadRequestException(
        "A previous withdrawal is still settling — try again in a couple of minutes",
      );
    }

    const keypair = this.stellar.deriveCustodialKeypair(playerId);
    if (toAddress === keypair.publicKey()) {
      throw new BadRequestException("Cannot withdraw to the custodial address itself");
    }
    const balance = await this.stellar.usdcBalance(keypair.publicKey());

    if (parseFloat(balance) < amountNum) {
      throw new BadRequestException("Insufficient USDC balance");
    }

    const outcome = await this.chainTx.submitUsdcPayment({
      kind: "USDC_WITHDRAWAL",
      idempotencyKey: `withdraw:${playerId}:${crypto.randomUUID()}`,
      from: keypair,
      to: toAddress,
      amount,
      memo: `drift:${playerId.slice(0, 8)}`,
      payload: { playerId, toAddress, amount },
    });

    if (outcome.status === "FAILED") {
      throw new BadRequestException(`Withdrawal rejected by the network: ${outcome.error}`);
    }
    return { txHash: outcome.txHash, status: outcome.status };
  }

  /** Credits balance (from ledger) + on-chain USDC balance together. */
  async getBalances(playerId: string) {
    const keypair = this.stellar.deriveCustodialKeypair(playerId);
    const publicKey = keypair.publicKey();
    const [credits, usdc] = await Promise.all([
      this.ledger.balanceOf(playerId, "CREDITS"),
      this.stellar.usdcBalance(publicKey),
    ]);
    return { credits: credits.toString(), usdc, custodialAddress: publicKey };
  }

  /**
   * Testnet-only: mint 50 test USDC into the player's custodial wallet.
   * Ensures account + trustline exist first, then issues from our own USDC issuer.
   */
  async airdrop(playerId: string): Promise<{ txHash: string; amount: string; address: string }> {
    if (!this.stellar.isTestnetMode) {
      throw new ServiceUnavailableException("Airdrop only available on testnet");
    }
    if (!this.stellar.canMintUsdc) {
      throw new ServiceUnavailableException("STELLAR_USDC_ISSUER_SECRET not configured");
    }

    const keypair = this.stellar.deriveCustodialKeypair(playerId);
    const publicKey = keypair.publicKey();

    // Ensure account exists + trustline set before minting
    await this.stellar.ensureUsdcTrustline(keypair);

    const amount = "50.0000000";
    const txHash = await this.stellar.mintTestUsdc(publicKey, amount);
    return { txHash, amount, address: publicKey };
  }
}
