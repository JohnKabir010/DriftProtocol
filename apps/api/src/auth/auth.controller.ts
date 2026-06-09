import { Controller, Post } from "@nestjs/common";
import { AuthService, SessionTokens } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Instant play — no signup friction. */
  @Post("guest")
  async guest(): Promise<SessionTokens> {
    return this.auth.createGuestSession();
  }

  // OAuth start/callback routes (Google/Discord) are wired with passport
  // strategies; omitted handlers delegate to AuthService.upsertSocialUser.
}
