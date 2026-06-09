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
    const handle = `racer_${Math.random().toString(36).slice(2, 8)}`;
    const user = await this.prisma.user.create({
      data: {
        authProvider: "guest",
        authSubject: crypto.randomUUID(),
        player: { create: { handle } },
      },
      include: { player: true },
    });
    return this.issueTokens(user.id, user.player!.id, user.player!.handle);
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
        player: { create: { handle: `racer_${Math.random().toString(36).slice(2, 8)}` } },
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
