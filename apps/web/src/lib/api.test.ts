import { describe, it, expect } from "vitest";

// Pure unit tests for API response type shapes and url helpers.
// These run in node environment without a live backend.

import type {
  MarketListingRow,
  BetPoolRow,
  LeaderboardRow,
  CarWithUpgrades,
  CarUpgrade,
  WalletInfo,
  TournamentRow,
  MyBetRow,
  FactionSummary,
  DistrictSummary,
} from "./api";

// ── Type guard helpers ────────────────────────────────────────────────────

function isLeaderboardRow(v: unknown): v is LeaderboardRow {
  const r = v as LeaderboardRow;
  return (
    typeof r === "object" &&
    r !== null &&
    typeof r.rank === "number" &&
    typeof r.id === "string" &&
    typeof r.handle === "string" &&
    typeof r.level === "number" &&
    typeof r.rep === "number" &&
    typeof r.tier === "string" &&
    typeof r.wins === "number"
  );
}

function isCar(v: unknown): v is CarWithUpgrades {
  const c = v as CarWithUpgrades;
  return (
    typeof c === "object" &&
    c !== null &&
    typeof c.id === "string" &&
    typeof c.modelKey === "string" &&
    typeof c.carClass === "string" &&
    Array.isArray(c.upgrades)
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("LeaderboardRow type guard", () => {
  it("accepts a valid leaderboard row", () => {
    const row: LeaderboardRow = { rank: 1, id: "p1", handle: "ghost", level: 7, rep: 4200, tier: "SYNDICATE", wins: 12 };
    expect(isLeaderboardRow(row)).toBe(true);
  });

  it("rejects an object with missing fields", () => {
    expect(isLeaderboardRow({ rank: 1, id: "p1" })).toBe(false);
  });

  it("rejects null", () => {
    expect(isLeaderboardRow(null)).toBe(false);
  });
});

describe("CarWithUpgrades type guard", () => {
  it("accepts a car with empty upgrades", () => {
    const car: CarWithUpgrades = {
      id: "c1",
      modelKey: "d-phantom-hatch",
      carClass: "D",
      nickname: null,
      livery: {},
      upgrades: [],
    };
    expect(isCar(car)).toBe(true);
  });

  it("accepts a car with upgrades", () => {
    const upgrade: CarUpgrade = { id: "u1", slot: "ENGINE", tier: 3 };
    const car: CarWithUpgrades = {
      id: "c1",
      modelKey: "c-neon-runner",
      carClass: "C",
      nickname: "Ghostline",
      livery: { primary: "#00f0ff" },
      upgrades: [upgrade],
    };
    expect(isCar(car)).toBe(true);
  });
});

describe("WalletInfo shape", () => {
  it("matches expected wallet info shape", () => {
    const wallet: WalletInfo = {
      custodialAddress: "GDEMO...",
      usdcBalance: "10.0000000",
      xlmBalance: "5.0000000",
      linkedWallets: [{ id: "w1", publicKey: "GLINK...", verifiedAt: new Date().toISOString() }],
    };
    expect(wallet.custodialAddress).toContain("G");
    expect(parseFloat(wallet.usdcBalance)).toBeGreaterThanOrEqual(0);
    expect(wallet.linkedWallets).toHaveLength(1);
  });
});

describe("FactionSummary shape", () => {
  it("contains required fields", () => {
    const faction: FactionSummary = { id: "f1", name: "Neon Vipers", tag: "[NV]", rep: 5000, memberCount: 8 };
    expect(faction.tag).toBeTruthy();
    expect(faction.memberCount).toBeGreaterThan(0);
  });
});

describe("DistrictSummary shape", () => {
  it("allows null controller", () => {
    const district: DistrictSummary = {
      id: "d1",
      key: "docklands",
      name: "Docklands",
      controller: null,
      epochEndsAt: null,
      topInfluence: [],
      totalInfluence: 0,
    };
    expect(district.controller).toBeNull();
  });
});

describe("BetPoolRow shape", () => {
  it("parses a bet pool row", () => {
    const pool: BetPoolRow = {
      id: "bp1",
      raceId: "r1",
      kind: "WIN",
      rakeBps: 500,
      closesAt: new Date().toISOString(),
      trackId: "neon-row",
      mode: "CIRCUIT",
      totalStaked: "1000",
      entrants: [{ playerId: "p1", handle: "ghost", repTier: "STREET", staked: "100" }],
    };
    expect(pool.rakeBps).toBe(500);
    expect(pool.entrants).toHaveLength(1);
  });
});

describe("TournamentRow shape", () => {
  it("parses a tournament row", () => {
    const t: TournamentRow = {
      id: "t1",
      name: "Neo-Meridian Open",
      mode: "CIRCUIT",
      currency: "USDC",
      entryFee: "5.0",
      bracketSize: 8,
      status: "REGISTRATION",
      startsAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    expect(t.bracketSize).toBe(8);
    expect(t.currency).toBe("USDC");
  });
});

describe("MyBetRow shape", () => {
  it("allows null payout for unsettled bets", () => {
    const bet: MyBetRow = {
      id: "b1",
      poolId: "bp1",
      raceId: "r1",
      kind: "WIN",
      poolStatus: "OPEN",
      selectionId: "p1",
      stake: "500",
      payout: null,
      createdAt: new Date().toISOString(),
    };
    expect(bet.payout).toBeNull();
  });
});

describe("MarketListingRow shape", () => {
  it("has required fields", () => {
    const listing: MarketListingRow = {
      id: "l1",
      assetType: "CAR",
      assetRef: "car-id-123",
      price: "10000",
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
      seller: { handle: "ghost_rider", repTier: "UNDERGROUND" },
      carModel: { name: "Phantom Hatch", carClass: "D", accentColor: "#00f0ff" },
    };
    expect(listing.seller.repTier).toBe("UNDERGROUND");
  });
});
