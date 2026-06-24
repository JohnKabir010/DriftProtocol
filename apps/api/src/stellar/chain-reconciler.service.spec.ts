import { ChainReconcilerService } from "./chain-reconciler.service";

type Row = {
  id: string;
  status: string;
  txHash: string | null;
  payload: unknown;
  createdAt: Date;
};

function makeService(rows: Row[], lookups: Record<string, { status: string; resultCodes?: string }>) {
  const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
  const prisma = {
    chainTx: {
      findMany: jest.fn().mockResolvedValue(rows),
      update: jest.fn().mockImplementation(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        updates.push({ id: where.id, data });
        return Promise.resolve({});
      }),
    },
  };
  const stellar = {
    getTransactionStatus: jest.fn().mockImplementation((hash: string) => {
      const res = lookups[hash];
      if (!res) return Promise.reject(new Error("unexpected lookup"));
      return Promise.resolve(res);
    }),
  };
  const redis = { tryLock: jest.fn().mockResolvedValue(true) };
  const svc = new ChainReconcilerService(prisma as never, stellar as never, redis as never);
  return { svc, updates, prisma, stellar };
}

const MINUTE = 60_000;
const old = (msAgo: number) => new Date(Date.now() - msAgo);
const future = (msAhead: number) => new Date(Date.now() + msAhead).toISOString();

describe("ChainReconcilerService.sweep", () => {
  it("confirms a SUBMITTED tx found successful on-chain", async () => {
    const { svc, updates } = makeService(
      [{ id: "a", status: "SUBMITTED", txHash: "h1", payload: {}, createdAt: old(5 * MINUTE) }],
      { h1: { status: "confirmed" } },
    );
    await svc.sweep();
    expect(updates).toEqual([{ id: "a", data: { status: "CONFIRMED", error: null } }]);
  });

  it("fails a SUBMITTED tx that failed on-chain", async () => {
    const { svc, updates } = makeService(
      [{ id: "b", status: "SUBMITTED", txHash: "h2", payload: {}, createdAt: old(5 * MINUTE) }],
      { h2: { status: "failed", resultCodes: "tx_failed" } },
    );
    await svc.sweep();
    expect(updates).toHaveLength(1);
    expect(updates[0]!.data.status).toBe("FAILED");
  });

  it("fails a tx not found after its timebounds expired (safe-retry guarantee)", async () => {
    const { svc, updates } = makeService(
      [
        {
          id: "c",
          status: "SUBMITTED",
          txHash: "h3",
          payload: { expiresAt: old(3 * MINUTE).toISOString() },
          createdAt: old(10 * MINUTE),
        },
      ],
      { h3: { status: "not_found" } },
    );
    await svc.sweep();
    expect(updates).toHaveLength(1);
    expect(updates[0]!.data.status).toBe("FAILED");
  });

  it("leaves a tx alone while its timebounds are still open", async () => {
    const { svc, updates } = makeService(
      [
        {
          id: "d",
          status: "SUBMITTED",
          txHash: "h4",
          payload: { expiresAt: future(MINUTE) },
          createdAt: old(2 * MINUTE),
        },
      ],
      { h4: { status: "not_found" } },
    );
    await svc.sweep();
    expect(updates).toHaveLength(0); // indeterminate — must not guess
  });

  it("does not touch fresh PENDING rows (still owned by the request)", async () => {
    const { svc, updates, stellar } = makeService(
      [{ id: "e", status: "PENDING", txHash: "h5", payload: {}, createdAt: old(5_000) }],
      {},
    );
    await svc.sweep();
    expect(stellar.getTransactionStatus).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it("fails hash-less orphan rows only after the generous timeout", async () => {
    const { svc, updates } = makeService(
      [
        { id: "f", status: "SUBMITTED", txHash: null, payload: {}, createdAt: old(2 * 60 * MINUTE) },
        { id: "g", status: "SUBMITTED", txHash: null, payload: {}, createdAt: old(5 * MINUTE) },
      ],
      {},
    );
    await svc.sweep();
    expect(updates.map((u) => u.id)).toEqual(["f"]);
    expect(updates[0]!.data.status).toBe("FAILED");
  });

  it("a Horizon error on one row does not block the rest of the batch", async () => {
    const { svc, updates } = makeService(
      [
        { id: "h", status: "SUBMITTED", txHash: "boom", payload: {}, createdAt: old(5 * MINUTE) },
        { id: "i", status: "SUBMITTED", txHash: "h6", payload: {}, createdAt: old(5 * MINUTE) },
      ],
      { h6: { status: "confirmed" } },
    );
    await svc.sweep();
    expect(updates).toEqual([{ id: "i", data: { status: "CONFIRMED", error: null } }]);
  });
});
