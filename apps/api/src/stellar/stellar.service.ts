import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomBytes } from "crypto";
import {
  Keypair,
  Networks,
  TransactionBuilder,
  Operation,
  Asset,
  Memo,
  BASE_FEE,
  Horizon,
} from "@stellar/stellar-sdk";

@Injectable()
export class StellarService implements OnModuleInit {
  private readonly logger = new Logger(StellarService.name);
  private server!: Horizon.Server;
  private networkPassphrase!: string;
  private masterSeed!: Buffer;
  private usdc!: Asset;
  private usdcIssuerKeypair?: Keypair; // only on testnet with our own issuer
  private houseKeypair?: Keypair;      // tournament prize treasury
  private isTestnet!: boolean;

  // In-process cache: public keys known to have the USDC trustline already set.
  private readonly trustlineCache = new Set<string>();

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const horizonUrl = this.config.get("STELLAR_HORIZON_URL", "https://horizon-testnet.stellar.org");
    const passphrase = this.config.get("STELLAR_NETWORK_PASSPHRASE", Networks.TESTNET);
    const masterSeedHex = this.config.get("STELLAR_MASTER_SEED", "0".repeat(64));
    const usdcIssuer = this.config.get(
      "STELLAR_USDC_ISSUER",
      "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    );
    const usdcIssuerSecret = this.config.get<string>("STELLAR_USDC_ISSUER_SECRET");
    const houseSecret = this.config.get<string>("STELLAR_HOUSE_SECRET");

    this.server = new Horizon.Server(horizonUrl);
    this.networkPassphrase = passphrase;
    this.masterSeed = Buffer.from(masterSeedHex, "hex");
    this.usdc = new Asset("USDC", usdcIssuer);
    this.isTestnet = passphrase === Networks.TESTNET;

    // The master seed derives EVERY custodial key. A known/default seed means
    // anyone can recompute player secrets — never allow it outside local dev.
    const seedIsDefault = /^0+$/.test(masterSeedHex);
    if (seedIsDefault && (!this.isTestnet || process.env.NODE_ENV === "production")) {
      throw new Error(
        "STELLAR_MASTER_SEED is unset/default — refusing to derive custodial keys in this environment",
      );
    }

    if (usdcIssuerSecret) {
      this.usdcIssuerKeypair = Keypair.fromSecret(usdcIssuerSecret);
      this.logger.log(`Test USDC issuer loaded: ${this.usdcIssuerKeypair.publicKey()}`);
    }
    if (houseSecret) {
      this.houseKeypair = Keypair.fromSecret(houseSecret);
      this.logger.log(`House treasury loaded: ${this.houseKeypair.publicKey()}`);
    }

    this.logger.log(`Stellar configured → ${horizonUrl} [${this.isTestnet ? "testnet" : "mainnet"}]`);
  }

  /** Deterministically derive a custodial keypair for a player. No secret ever persisted. */
  deriveCustodialKeypair(playerId: string): Keypair {
    const seed = createHmac("sha256", this.masterSeed).update(playerId).digest();
    return Keypair.fromRawEd25519Seed(seed);
  }

  /**
   * Surge-aware fee: 2× the network's current base fee, clamped to
   * [BASE_FEE, 0.001 XLM]. A static BASE_FEE gets every tx dropped the
   * moment the network is busy; an unclamped fee is a griefing vector.
   */
  private async currentFee(): Promise<string> {
    try {
      const base = await this.server.fetchBaseFee();
      return String(Math.min(Math.max(base * 2, Number(BASE_FEE)), 10_000));
    } catch {
      return BASE_FEE;
    }
  }

  get usdcAsset(): Asset { return this.usdc; }
  get isTestnetMode(): boolean { return this.isTestnet; }
  get canMintUsdc(): boolean { return !!this.usdcIssuerKeypair; }

  /**
   * Ensure the custodial account exists on-chain.
   * Testnet: friendbot. Mainnet: beginSponsoringFutureReserves.
   */
  async ensureAccount(keypair: Keypair): Promise<Horizon.AccountResponse> {
    try {
      return await this.server.loadAccount(keypair.publicKey());
    } catch {
      if (this.isTestnet) {
        await this.friendbotFund(keypair.publicKey());
      } else {
        await this.sponsorFund(keypair);
      }
      return this.server.loadAccount(keypair.publicKey());
    }
  }

  /**
   * Set USDC trustline on the custodial account if not already present.
   * Results are cached in-process so repeat calls for the same account are fast.
   */
  async ensureUsdcTrustline(keypair: Keypair): Promise<void> {
    const pub = keypair.publicKey();
    if (this.trustlineCache.has(pub)) return;

    const account = await this.ensureAccount(keypair);
    const hasUsdc = account.balances.some(
      (b) =>
        b.asset_type !== "native" &&
        (b as Horizon.HorizonApi.BalanceLine<"credit_alphanum4" | "credit_alphanum12">).asset_code === "USDC" &&
        (b as Horizon.HorizonApi.BalanceLine<"credit_alphanum4" | "credit_alphanum12">).asset_issuer === this.usdc.getIssuer(),
    );

    if (hasUsdc) {
      this.trustlineCache.add(pub);
      return;
    }

    const tx = new TransactionBuilder(account, {
      fee: await this.currentFee(),
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(Operation.changeTrust({ asset: this.usdc }))
      .setTimeout(30)
      .build();

    tx.sign(keypair);
    await this.server.submitTransaction(tx);
    this.trustlineCache.add(pub);
    this.logger.log(`USDC trustline set for ${pub}`);
  }

  /** Returns the USDC balance for a public key, or "0" if no trustline/account. */
  async usdcBalance(publicKey: string): Promise<string> {
    try {
      const account = await this.server.loadAccount(publicKey);
      const line = account.balances.find(
        (b) =>
          b.asset_type !== "native" &&
          (b as Horizon.HorizonApi.BalanceLine<"credit_alphanum4" | "credit_alphanum12">).asset_code === "USDC" &&
          (b as Horizon.HorizonApi.BalanceLine<"credit_alphanum4" | "credit_alphanum12">).asset_issuer === this.usdc.getIssuer(),
      ) as Horizon.HorizonApi.BalanceLine<"credit_alphanum4"> | undefined;
      return line?.balance ?? "0";
    } catch {
      return "0";
    }
  }

  /** XLM balance for native balance display. */
  async xlmBalance(publicKey: string): Promise<string> {
    try {
      const account = await this.server.loadAccount(publicKey);
      const native = account.balances.find((b) => b.asset_type === "native") as
        | Horizon.HorizonApi.BalanceLine<"native">
        | undefined;
      return native?.balance ?? "0";
    } catch {
      return "0";
    }
  }

  /**
   * Mint test USDC from our own issuer to any address.
   * Only works when STELLAR_USDC_ISSUER_SECRET is configured (testnet).
   */
  async mintTestUsdc(toPublicKey: string, amount: string): Promise<string> {
    if (!this.usdcIssuerKeypair) throw new Error("USDC minting not configured (no issuer secret)");

    const issuerAccount = await this.server.loadAccount(this.usdcIssuerKeypair.publicKey());
    const tx = new TransactionBuilder(issuerAccount, {
      fee: await this.currentFee(),
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        Operation.payment({
          destination: toPublicKey,
          asset: this.usdc,
          amount,
        }),
      )
      .addMemo(Memo.text("drift:airdrop"))
      .setTimeout(30)
      .build();

    tx.sign(this.usdcIssuerKeypair);
    const result = await this.server.submitTransaction(tx);
    this.logger.log(`Minted ${amount} test USDC → ${toPublicKey}`);
    return result.hash;
  }

  /**
   * Build and sign a USDC payment WITHOUT submitting it. Returns the envelope
   * XDR, the locally computed hash, and the timebounds expiry. Persisting
   * these before submission is what makes outcomes recoverable: any later
   * Horizon lookup by hash is authoritative, and once `expiresAt` has passed
   * without the tx appearing on-chain, the network guarantees it never will.
   */
  async buildUsdcPayment(
    fromKeypair: Keypair,
    toPublicKey: string,
    amount: string,
    memo?: string,
  ): Promise<{ xdr: string; hash: string; expiresAt: Date }> {
    await this.ensureUsdcTrustline(fromKeypair);
    const account = await this.server.loadAccount(fromKeypair.publicKey());

    const builder = new TransactionBuilder(account, {
      fee: await this.currentFee(),
      networkPassphrase: this.networkPassphrase,
    }).addOperation(
      Operation.payment({
        destination: toPublicKey,
        asset: this.usdc,
        amount,
      }),
    );

    if (memo) builder.addMemo(Memo.text(memo.slice(0, 28)));
    builder.setTimeout(60);

    const tx = builder.build();
    tx.sign(fromKeypair);

    const maxTime = Number(tx.timeBounds?.maxTime ?? 0);
    return {
      xdr: tx.toXDR(),
      hash: tx.hash().toString("hex"),
      expiresAt: maxTime > 0 ? new Date(maxTime * 1000) : new Date(Date.now() + 60_000),
    };
  }

  /** Submit a previously built envelope. Throws Horizon errors unmodified. */
  async submitXdr(xdr: string): Promise<void> {
    const tx = TransactionBuilder.fromXDR(xdr, this.networkPassphrase);
    await this.server.submitTransaction(tx);
  }

  /**
   * Authoritative status of a transaction by hash.
   * "not_found" only means "not yet" until the tx's timebounds have expired.
   */
  async getTransactionStatus(
    hash: string,
  ): Promise<{ status: "confirmed" | "failed" | "not_found"; resultCodes?: string }> {
    try {
      const record = await this.server.transactions().transaction(hash).call();
      return record.successful
        ? { status: "confirmed" }
        : { status: "failed", resultCodes: record.result_xdr };
    } catch (err) {
      if ((err as { response?: { status?: number } })?.response?.status === 404) {
        return { status: "not_found" };
      }
      throw err; // network fault — caller retries on the next sweep
    }
  }

  /** Get the house treasury keypair (for tournament prize distribution). */
  getHouseKeypair(): Keypair | undefined {
    return this.houseKeypair;
  }

  /** Verify a Stellar public key signed a challenge (SEP-10 style Freighter linking). */
  verifyChallenge(publicKey: string, challenge: string, signature: string): boolean {
    try {
      const kp = Keypair.fromPublicKey(publicKey);
      return kp.verify(Buffer.from(challenge, "hex"), Buffer.from(signature, "base64"));
    } catch {
      return false;
    }
  }

  /** Generate an unpredictable hex challenge string for wallet linking. */
  generateChallenge(): string {
    return randomBytes(32).toString("hex");
  }

  private async friendbotFund(publicKey: string): Promise<void> {
    const res = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`);
    if (!res.ok) throw new Error(`Friendbot failed: ${res.status}`);
    this.logger.log(`Friendbot funded ${publicKey}`);
  }

  private async sponsorFund(keypair: Keypair): Promise<void> {
    const sponsorSecret = this.config.get<string>("STELLAR_SPONSOR_SECRET");
    if (!sponsorSecret) throw new Error("No STELLAR_SPONSOR_SECRET configured for mainnet funding");

    const sponsor = Keypair.fromSecret(sponsorSecret);
    const sponsorAccount = await this.server.loadAccount(sponsor.publicKey());

    const tx = new TransactionBuilder(sponsorAccount, {
      fee: await this.currentFee(),
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(Operation.beginSponsoringFutureReserves({ sponsoredId: keypair.publicKey() }))
      .addOperation(
        Operation.createAccount({
          destination: keypair.publicKey(),
          startingBalance: "0",
        }),
      )
      .addOperation(
        Operation.endSponsoringFutureReserves({ source: keypair.publicKey() }),
      )
      .setTimeout(30)
      .build();

    tx.sign(sponsor, keypair);
    await this.server.submitTransaction(tx);
    this.logger.log(`Sponsor-funded ${keypair.publicKey()}`);
  }
}
