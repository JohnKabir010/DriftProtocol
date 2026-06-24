import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";

export interface SessionTokens {
  accessToken: string;
  playerId: string;
  handle: string;
}

/**
 * Social-login-first auth. Guest sessions allow instant play; the account is
 * upgraded in place when the player attaches Google/Discord, so progress is
 * never lost. Wallets are linked later via a SEP-10-style challenge and are
 * NEVER required for gameplay.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Instant-play path: anonymous user + auto-generated handle. */
  async createGuestSession(): Promise<SessionTokens> {
    // Handle has a unique constraint — retry on the (rare) collision instead of 500ing.
    for (let attempt = 0; ; attempt++) {
      try {
        const user = await this.prisma.user.create({
          data: {
            authProvider: "guest",
            authSubject: crypto.randomUUID(),
            player: { create: { handle: randomHandle() } },
          },
          include: { player: true },
        });
        return this.issueTokens(user.id, user.player!.id, user.player!.handle);
      } catch (err) {
        if (attempt >= 4 || !isUniqueViolation(err)) throw err;
      }
    }
  }

  /**
   * Resolve a verified provider identity to a session.
   * Three paths, in priority order:
   *  1. identity already linked        → log into THAT account (recovery: a
   *     player on a new device gets their progress and custodial funds back)
   *  2. caller holds a guest session   → upgrade the guest account in place
   *     (progress, cars, ledger, custodial wallet all carry over)
   *  3. otherwise                      → fresh account
   */
  async loginWithProvider(
    provider: "google" | "discord",
    subject: string,
    email: string | undefined,
    upgradeUserId?: string,
  ): Promise<SessionTokens> {
    const identity = await this.prisma.user.findUnique({
      where: { authProvider_authSubject: { authProvider: provider, authSubject: subject } },
      include: { player: true },
    });
    if (identity) {
      return this.issueTokens(identity.id, identity.player!.id, identity.player!.handle);
    }

    if (upgradeUserId) {
      const guest = await this.prisma.user.findUnique({
        where: { id: upgradeUserId },
        include: { player: true },
      });
      if (guest && guest.authProvider === "guest" && guest.player) {
        const upgraded = await this.prisma.user.update({
          where: { id: guest.id },
          data: { authProvider: provider, authSubject: subject, email },
          include: { player: true },
        });
        return this.issueTokens(upgraded.id, upgraded.player!.id, upgraded.player!.handle);
      }
    }

    return this.upsertSocialUser(provider, subject, email);
  }

  /** Called by the OAuth callback once the provider profile is verified. */
  async upsertSocialUser(provider: "google" | "discord", subject: string, email?: string): Promise<SessionTokens> {
    const user = await this.prisma.user.upsert({
      where: { authProvider_authSubject: { authProvider: provider, authSubject: subject } },
      update: { email },
      create: {
        authProvider: provider,
        authSubject: subject,
        email,
        player: { create: { handle: randomHandle() } },
      },
      include: { player: true },
    });
    return this.issueTokens(user.id, user.player!.id, user.player!.handle);
  }

  private issueTokens(userId: string, playerId: string, handle: string): SessionTokens {
    const accessToken = this.jwt.sign({ sub: userId, playerId, handle });
    return { accessToken, playerId, handle };
  }
}

function randomHandle(): string {
  return `racer_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}
