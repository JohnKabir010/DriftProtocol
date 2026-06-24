import { ChainTxService, extractResultCodes } from "./chain-tx.service";

const PAYMENT = {
  kind: "USDC_WITHDRAWAL",
  idempotencyKey: "withdraw:p1:k1",
  from: {} as never,
  to: "GDEST",
  amount: "5.0000000",
  payload: { playerId: "p1" },
};

function horizonRejection(codes: Record<string, unknown>) {
  return { response: { data: { extras: { result_codes: codes } } } };
}

function makeService(opts: {
  existing?: Record<string, unknown> | null;
  submit?: () => Promise<void>;
  lookup?: { status: string };
}) {
  const updates: Array<Record<string, unknown>> = [];
  const prisma = {
    chainTx: {
      findUnique: jest.fn().mockResolvedValue(opts.existing ?? null),
      create: jest.fn().mockResolvedValue({ id: "row1" }),
      update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return Promise.resolve({ id: "row1" });
      }),
    },
  };
  const stellar = {
    buildUsdcPayment: jest.fn().mockResolvedValue({
      xdr: "XDR",
      hash: "HASH1",
      expiresAt: new Date(Date.now() + 60_000),
    }),
    submitXdr: jest.fn().mockImplementation(opts.submit ?? (() => Promise.resolve())),
    getTransactionStatus: jest.fn().mockResolvedValue(opts.lookup ?? { status: "not_found" }),
  };
  return { svc: new ChainTxService(prisma as never, stellar as never), prisma, stellar, updates };
}

describe("extractResultCodes", () => {
  it("parses Horizon 400 rejection bodies", () => {
    expect(extractResultCodes(horizonRejection({ transaction: "tx_insufficient_balance" }))).toContain(
      "tx_insufficient_balance",
    );
  });

  it("returns null for timeouts and network errors (indeterminate)", () => {
    expect(extractResultCodes(new Error("ETIMEDOUT"))).toBeNull();
    expect(extractResultCodes({ response: { status: 504 } })).toBeNull();
  });
});

describe("ChainTxService.submitUsdcPayment", () => {
  it("confirms on clean submission and journals SUBMITTED before the network call", async () => {
    const { svc, updates, prisma } = makeService({});
    const out = await svc.submitUsdcPayment(PAYMENT);
    expect(out).toEqual({ status: "CONFIRMED", txHash: "HASH1" });
    // PENDING row is created with the hash + envelope, then SUBMITTED, then CONFIRMED.
    expect(prisma.chainTx.create).toHaveBeenCalledTimes(1);
    expect(updates.map((u) => u.status)).toEqual(["SUBMITTED", "CONFIRMED"]);
  });

  it("returns the recorded outcome for an already-CONFIRMED idempotency key", async () => {
    const { svc, stellar } = makeService({
      existing: { id: "row0", status: "CONFIRMED", txHash: "OLD" },
    });
    const out = await svc.submitUsdcPayment(PAYMENT);
    expect(out).toEqual({ status: "CONFIRMED", txHash: "OLD" });
    expect(stellar.submitXdr).not.toHaveBeenCalled(); // never double-pays
  });

  it("refuses to double-submit while a prior attempt is SUBMITTED", async () => {
    const { svc, stellar } = makeService({
      existing: { id: "row0", status: "SUBMITTED", txHash: "OLD" },
    });
    const out = await svc.submitUsdcPayment(PAYMENT);
    expect(out.status).toBe("SETTLING");
    expect(stellar.submitXdr).not.toHaveBeenCalled();
  });

  it("marks FAILED on a definitive rejection that is not on-chain", async () => {
    const { svc, updates } = makeService({
      submit: () => Promise.reject(horizonRejection({ operations: ["op_underfunded"] })),
      lookup: { status: "not_found" },
    });
    const out = await svc.submitUsdcPayment(PAYMENT);
    expect(out.status).toBe("FAILED");
    expect(updates.map((u) => u.status)).toEqual(["SUBMITTED", "FAILED"]);
  });

  it("trusts the chain over the error: rejection + on-chain record = CONFIRMED", async () => {
    const { svc } = makeService({
      submit: () => Promise.reject(horizonRejection({ transaction: "tx_bad_seq" })),
      lookup: { status: "confirmed" },
    });
    const out = await svc.submitUsdcPayment(PAYMENT);
    expect(out).toEqual({ status: "CONFIRMED", txHash: "HASH1" });
  });

  it("leaves an indeterminate outcome SUBMITTED for the reconciler — never FAILED", async () => {
    const { svc, updates } = makeService({
      submit: () => Promise.reject(new Error("socket hang up")),
      lookup: { status: "not_found" },
    });
    const out = await svc.submitUsdcPayment(PAYMENT);
    expect(out.status).toBe("SETTLING");
    // No FAILED write: guessing "failed" on a timeout is the double-pay bug.
    expect(updates.map((u) => u.status)).toEqual(["SUBMITTED"]);
  });

  it("re-arms a FAILED row under the same idempotency key with a fresh envelope", async () => {
    const { svc, prisma, updates } = makeService({
      existing: { id: "row0", status: "FAILED", txHash: "OLDHASH" },
    });
    const out = await svc.submitUsdcPayment(PAYMENT);
    expect(out).toEqual({ status: "CONFIRMED", txHash: "HASH1" });
    expect(prisma.chainTx.create).not.toHaveBeenCalled(); // reuses the row
    expect(updates[0]).toMatchObject({ status: "PENDING", txHash: "HASH1" });
  });
});
