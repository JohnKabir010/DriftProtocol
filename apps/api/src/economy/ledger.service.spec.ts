import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { LedgerService } from "./ledger.service";

// ---------------------------------------------------------------------------
// Minimal Prisma mock — no DB needed for pure ledger logic.
// ---------------------------------------------------------------------------

function makeUniqueError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "5.0.0",
  });
}

function makeLedger(opts: {
  sumAmount?: bigint;
  shouldThrowUnique?: boolean;
  shouldThrowSerializable?: boolean;
}) {
  const posted: unknown[] = [];

  const prisma = {
    $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      if (opts.shouldThrowSerializable) {
        throw new Prisma.PrismaClientKnownRequestError("Serialization failure", {
          code: "P2034",
          clientVersion: "5.0.0",
        });
      }
      if (opts.shouldThrowUnique) {
        throw makeUniqueError();
      }
      const tx = {
        ledgerEntry: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { amount: opts.sumAmount ?? 0n } }),
          createMany: jest.fn().mockImplementation(({ data }: { data: unknown[] }) => {
            posted.push(...data);
            return Promise.resolve({ count: data.length });
          }),
        },
      };
      return fn(tx);
    }),
    ledgerEntry: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: opts.sumAmount ?? 0n } }),
    },
  };

  const svc = new LedgerService(prisma as never);
  return { svc, posted };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LedgerService.post", () => {
  it("rejects an unbalanced journal before touching the DB", async () => {
    const { svc } = makeLedger({});
    await expect(
      svc.post({
        currency: "CREDITS",
        reason: "TEST",
        idempotencyKey: "k1",
        legs: [{ playerId: "p1", amount: 100n }], // no balancing leg
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("posts a balanced journal and writes both legs", async () => {
    const { svc, posted } = makeLedger({ sumAmount: 5000n });
    await svc.post({
      currency: "CREDITS",
      reason: "RACE_REWARD",
      idempotencyKey: "race:r1:reward:p1",
      legs: [
        { playerId: "p1", amount: 500n },
        { playerId: null, amount: -500n },
      ],
    });
    expect(posted).toHaveLength(2);
  });

  it("rejects an overdraft when a player balance would go negative", async () => {
    const { svc } = makeLedger({ sumAmount: 100n }); // player has 100 credits
    await expect(
      svc.post({
        currency: "CREDITS",
        reason: "PURCHASE",
        idempotencyKey: "buy:1",
        legs: [
          { playerId: "p1", amount: -200n }, // spending more than balance
          { playerId: null, amount: 200n },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("treats a unique-constraint violation as an already-applied idempotent key", async () => {
    const { svc } = makeLedger({ shouldThrowUnique: true });
    // Should resolve without throwing — idempotency key already exists = success
    await expect(
      svc.post({
        currency: "CREDITS",
        reason: "RACE_REWARD",
        idempotencyKey: "race:r2:reward:p2",
        legs: [
          { playerId: "p2", amount: 300n },
          { playerId: null, amount: -300n },
        ],
      }),
    ).resolves.toBeUndefined();
  });
});

describe("LedgerService.balanceOf", () => {
  it("returns the aggregated balance from the ledger sum", async () => {
    const { svc } = makeLedger({ sumAmount: 1200n });
    const balance = await svc.balanceOf("p1", "CREDITS");
    expect(balance).toBe(1200n);
  });

  it("returns 0n for a player with no ledger entries", async () => {
    const { svc } = makeLedger({ sumAmount: undefined });
    const balance = await svc.balanceOf("new-player", "CREDITS");
    expect(balance).toBe(0n);
  });
});
