import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";

export type OAuthProvider = "google" | "discord";

export interface ProviderProfile {
  subject: string;
  email?: string;
}

/**
 * Server-side authorization-code exchange for Google and Discord. No SDK —
 * two fetches per provider against documented, stable endpoints. Secrets
 * never leave the API; the browser only ever sees the redirect.
 */
@Injectable()
export class OAuthService {
  private apiPublicUrl(): string {
    return process.env.API_PUBLIC_URL ?? "http://localhost:4000";
  }

  redirectUri(provider: OAuthProvider): string {
    return `${this.apiPublicUrl()}/v1/auth/${provider}/callback`;
  }

  private credentials(provider: OAuthProvider): { clientId: string; clientSecret: string } {
    const clientId =
      provider === "google"
        ? process.env.GOOGLE_OAUTH_CLIENT_ID
        : process.env.DISCORD_OAUTH_CLIENT_ID;
    const clientSecret =
      provider === "google"
        ? process.env.GOOGLE_OAUTH_CLIENT_SECRET
        : process.env.DISCORD_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(`${provider} login is not configured`);
    }
    return { clientId, clientSecret };
  }

  /** Provider authorize URL the browser is redirected to. */
  authorizeUrl(provider: OAuthProvider, state: string): string {
    const { clientId } = this.credentials(provider);
    const redirect = encodeURIComponent(this.redirectUri(provider));
    if (provider === "google") {
      return (
        `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}` +
        `&redirect_uri=${redirect}&response_type=code&scope=openid%20email&state=${state}`
      );
    }
    return (
      `https://discord.com/oauth2/authorize?client_id=${clientId}` +
      `&redirect_uri=${redirect}&response_type=code&scope=identify%20email&state=${state}`
    );
  }

  /** Exchange the callback code for a verified provider profile. */
  async exchangeCode(provider: OAuthProvider, code: string): Promise<ProviderProfile> {
    return provider === "google" ? this.exchangeGoogle(code) : this.exchangeDiscord(code);
  }

  private async exchangeGoogle(code: string): Promise<ProviderProfile> {
    const { clientId, clientSecret } = this.credentials("google");
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: this.redirectUri("google"),
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw new BadRequestException("Google code exchange failed");
    const { id_token } = (await tokenRes.json()) as { id_token?: string };
    if (!id_token) throw new BadRequestException("Google response missing id_token");

    // Server-side validation of the ID token — audience must be OUR client.
    const infoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(id_token)}`,
    );
    if (!infoRes.ok) throw new BadRequestException("Google id_token validation failed");
    const info = (await infoRes.json()) as { sub?: string; email?: string; aud?: string };
    if (!info.sub || info.aud !== clientId) {
      throw new BadRequestException("Google id_token audience mismatch");
    }
    return { subject: info.sub, email: info.email };
  }

  private async exchangeDiscord(code: string): Promise<ProviderProfile> {
    const { clientId, clientSecret } = this.credentials("discord");
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: this.redirectUri("discord"),
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw new BadRequestException("Discord code exchange failed");
    const { access_token } = (await tokenRes.json()) as { access_token?: string };
    if (!access_token) throw new BadRequestException("Discord response missing access_token");

    const meRes = await fetch("https://discord.com/api/users/@me", {
      headers: { authorization: `Bearer ${access_token}` },
    });
    if (!meRes.ok) throw new BadRequestException("Discord profile fetch failed");
    const me = (await meRes.json()) as { id?: string; email?: string };
    if (!me.id) throw new BadRequestException("Discord profile missing id");
    return { subject: me.id, email: me.email };
  }
}
