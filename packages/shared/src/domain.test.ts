import { describe, it, expect } from "vitest";
import {
  RaceMode,
  CarClass,
  MatchTicketSchema,
  RaceResultReportSchema,
  PlayerProfileSchema,
  UpgradeSlot,
  RepTier,
  BotDifficulty,
} from "./domain.js";

describe("RaceMode enum", () => {
  it("accepts all valid modes", () => {
    const modes = ["SPRINT", "CIRCUIT", "DRIFT_TRIAL", "DUEL", "FACTION_WAR", "TOURNAMENT", "BOT_RACE"];
    for (const mode of modes) {
      expect(() => RaceMode.parse(mode)).not.toThrow();
    }
  });

  it("rejects unknown modes", () => {
    expect(() => RaceMode.parse("INVALID_MODE")).toThrow();
    expect(() => RaceMode.parse("")).toThrow();
  });
});

describe("CarClass enum", () => {
  it("accepts D C B A S", () => {
    for (const cls of ["D", "C", "B", "A", "S"]) {
      expect(CarClass.parse(cls)).toBe(cls);
    }
  });

  it("rejects lowercase and unknowns", () => {
    expect(() => CarClass.parse("x")).toThrow();
    expect(() => CarClass.parse("F")).toThrow();
  });
});

describe("MatchTicketSchema", () => {
  const validTicket = {
    ticket: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dGVzdA.sig",
    roomId: "room-001",
    realtimeUrl: "ws://localhost:2567",
    mode: "CIRCUIT",
    carClass: "C",
    trackId: "neon-row",
  };

  it("accepts a minimal valid ticket", () => {
    const result = MatchTicketSchema.safeParse(validTicket);
    expect(result.success).toBe(true);
  });

  it("accepts optional fields: car, bots, botDifficulty", () => {
    const result = MatchTicketSchema.safeParse({
      ...validTicket,
      car: { carId: "car-1", modelKey: "d-phantom-hatch", upgrades: { ENGINE: 2 } },
      bots: 3,
      botDifficulty: "hard",
      raceId: "00000000-0000-0000-0000-000000000001",
    });
    expect(result.success).toBe(true);
  });

  it("rejects bots > 3", () => {
    const result = MatchTicketSchema.safeParse({ ...validTicket, bots: 4 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid mode", () => {
    const result = MatchTicketSchema.safeParse({ ...validTicket, mode: "DRAG" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid carClass", () => {
    const result = MatchTicketSchema.safeParse({ ...validTicket, carClass: "Z" });
    expect(result.success).toBe(false);
  });
});

describe("RaceResultReportSchema", () => {
  const validEntry = {
    playerId: "00000000-0000-0000-0000-000000000001",
    finishPosition: 1,
    finishTimeMs: 75000,
    bestLapMs: 35000,
    driftScore: 4200,
    cleanRaceBonus: true,
  };

  const validReport = {
    raceId: "00000000-0000-0000-0000-000000000002",
    mode: "CIRCUIT",
    trackId: "neon-row",
    serverSeed: "abc123",
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    entries: [validEntry],
    replayHash: "deadbeef",
  };

  it("accepts a valid race result report", () => {
    expect(RaceResultReportSchema.safeParse(validReport).success).toBe(true);
  });

  it("rejects entries with finishPosition > 8", () => {
    const bad = { ...validReport, entries: [{ ...validEntry, finishPosition: 9 }] };
    expect(RaceResultReportSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects empty entries array", () => {
    const bad = { ...validReport, entries: [] };
    expect(RaceResultReportSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects negative driftScore", () => {
    const bad = { ...validReport, entries: [{ ...validEntry, driftScore: -1 }] };
    expect(RaceResultReportSchema.safeParse(bad).success).toBe(false);
  });
});

describe("RepTier enum", () => {
  it("accepts all tiers", () => {
    for (const tier of ["STREET", "UNDERGROUND", "SYNDICATE", "LEGEND"]) {
      expect(RepTier.parse(tier)).toBe(tier);
    }
  });
});

describe("BotDifficulty enum", () => {
  it("accepts easy medium hard", () => {
    for (const d of ["easy", "medium", "hard"]) {
      expect(BotDifficulty.parse(d)).toBe(d);
    }
  });

  it("rejects EASY (case-sensitive)", () => {
    expect(() => BotDifficulty.parse("EASY")).toThrow();
  });
});

describe("UpgradeSlot enum", () => {
  it("accepts all 6 slots", () => {
    for (const slot of ["ENGINE", "TRANSMISSION", "TIRES", "NITRO", "ECU", "WEIGHT"]) {
      expect(UpgradeSlot.parse(slot)).toBe(slot);
    }
  });
});

describe("PlayerProfileSchema", () => {
  it("accepts a valid player profile", () => {
    const profile = {
      id: "00000000-0000-0000-0000-000000000001",
      handle: "ghost_runner",
      level: 5,
      rep: 1250,
      repTier: "UNDERGROUND",
      creditsBalance: "5000",
      avatarUrl: null,
    };
    expect(PlayerProfileSchema.safeParse(profile).success).toBe(true);
  });

  it("rejects handle shorter than 3 chars", () => {
    const bad = {
      id: "00000000-0000-0000-0000-000000000001",
      handle: "ab",
      level: 1,
      rep: 0,
      repTier: "STREET",
      creditsBalance: "0",
      avatarUrl: null,
    };
    expect(PlayerProfileSchema.safeParse(bad).success).toBe(false);
  });
});
