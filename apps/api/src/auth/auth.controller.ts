import { BadRequestException, Controller, Get, Param, Post, Query, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { JwtService } from "@nestjs/jwt";
import type { Response } from "express";
import { z } from "zod";
import { AuthService, SessionTokens } from "./auth.service";
import { OAuthService, type OAuthProvider } from "./oauth.service";

const Provider = z.enum(["google", "discord"]);

/** CSRF state for the OAuth round-trip; optionally carries the guest userId to upgrade. */
interface OAuthState {
  aud: "oauth-state";
  upgradeUserId?: string;
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly oauth: OAuthService,
    private readonly jwt: JwtService,
  ) {}

  /** Instant play — no signup friction. Rate-limited to 10/min to prevent session farming. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("guest")
  async guest(): Promise<SessionTokens> {
    return this.auth.createGuestSession();
  }

  /**
   * Start the provider flow. If the browser passes its current (guest)
   * access token, the resulting identity upgrades that account in place —
   * progress and custodial funds carry over.
   */
  @Get(":provider/start")
  start(
    @Param("provider") providerRaw: string,
    @Res() res: Response,
    @Query("upgrade") upgradeToken?: string,
  ): void {
    const provider = Provider.parse(providerRaw) as OAuthProvider;

    let upgradeUserId: string | undefined;
    if (upgradeToken) {
      try {
        upgradeUserId = (this.jwt.verify(upgradeToken) as { sub: string }).sub;
      } catch {
        /* expired/invalid session — proceed as a plain login */
      }
    }

    const state = this.jwt.sign(
      { aud: "oauth-state", upgradeUserId } satisfies OAuthState,
      { expiresIn: "10m" },
    );
    res.redirect(this.oauth.authorizeUrl(provider, state));
  }

  /** Provider redirects here; we exchange the code and hand the web a session. */
  @Get(":provider/callback")
  async callback(
    @Param("provider") providerRaw: string,
    @Res() res: Response,
    @Query("code") code?: string,
    @Query("state") stateRaw?: string,
  ): Promise<void> {
    const provider = Provider.parse(providerRaw) as OAuthProvider;
    if (!code || !stateRaw) throw new BadRequestException("missing code/state");

    let state: OAuthState;
    try {
      state = this.jwt.verify(stateRaw) as OAuthState;
      if (state.aud !== "oauth-state") throw new Error("wrong audience");
    } catch {
      throw new BadRequestException("invalid OAuth state");
    }

    const profile = await this.oauth.exchangeCode(provider, code);
    const session = await this.auth.loginWithProvider(
      provider,
      profile.subject,
      profile.email,
      state.upgradeUserId,
    );

    // Hand the session to the web app in the URL FRAGMENT — fragments never
    // reach servers or access logs, unlike query strings.
    const webOrigin = (process.env.WEB_ORIGIN ?? "http://localhost:3000").split(",")[0]!.trim();
    res.redirect(
      `${webOrigin}/auth/callback#token=${encodeURIComponent(session.accessToken)}` +
        `&playerId=${encodeURIComponent(session.playerId)}&handle=${encodeURIComponent(session.handle)}`,
    );
  }
}
