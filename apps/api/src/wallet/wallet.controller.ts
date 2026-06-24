import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { z } from "zod";
import { WalletService } from "./wallet.service";
import type { JwtPayload } from "../auth/jwt.strategy";

const LinkBody = z.object({
  publicKey: z.string().min(56).max(56),
  challenge: z.string().min(64),
  signature: z.string().min(1),
});

const WithdrawBody = z.object({
  toAddress: z.string().min(56).max(56),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
});

@Controller("wallet")
@UseGuards(AuthGuard("jwt"))
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  getWallet(@Req() req: { user: JwtPayload }) {
    return this.wallet.getWallet(req.user.playerId);
  }

  @Get("balances")
  getBalances(@Req() req: { user: JwtPayload }) {
    return this.wallet.getBalances(req.user.playerId);
  }

  @Get("challenge")
  getChallenge(@Req() req: { user: JwtPayload }) {
    return this.wallet.getChallenge(req.user.sub);
  }

  @Post("link")
  async linkWallet(@Body() body: unknown, @Req() req: { user: JwtPayload }) {
    const { publicKey, challenge, signature } = LinkBody.parse(body);
    await this.wallet.linkWallet(req.user.sub, publicKey, challenge, signature);
    return { ok: true };
  }

  @Delete("link/:id")
  async unlinkWallet(@Param("id", ParseUUIDPipe) id: string, @Req() req: { user: JwtPayload }) {
    await this.wallet.unlinkWallet(id, req.user.sub);
    return { ok: true };
  }

  @Post("withdraw")
  async withdraw(@Body() body: unknown, @Req() req: { user: JwtPayload }) {
    const { toAddress, amount } = WithdrawBody.parse(body);
    return this.wallet.withdraw(req.user.playerId, toAddress, amount);
  }

  /** Testnet only — mint 50 test USDC into the calling player's custodial wallet. */
  @Post("airdrop")
  airdrop(@Req() req: { user: JwtPayload }) {
    return this.wallet.airdrop(req.user.playerId);
  }
}
