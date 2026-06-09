import { z } from "zod";

// ── Core enums (mirrored in prisma/schema.prisma) ──────────────────────────

export const RaceMode = z.enum(["SPRINT", "CIRCUIT", "DRIFT_TRIAL", "DUEL", "FACTION_WAR", "TOURNAMENT"]);
export type RaceMode = z.infer<typeof RaceMode>;

export const CarClass = z.enum(["D", "C", "B", "A", "S"]);
export type CarClass = z.infer<typeof CarClass>;

export const RepTier = z.enum(["STREET", "UNDERGROUND", "SYNDICATE", "LEGEND"]);
export type RepTier = z.infer<typeof RepTier>;

export const UpgradeSlot = z.enum(["ENGINE", "TRANSMISSION", "TIRES", "NITRO", "ECU", "WEIGHT"]);
export type UpgradeSlot = z.infer<typeof UpgradeSlot>;

// ── Money. Credits are offchain soft currency; USDC settles on Stellar.
// Both are integers in minor units. There is deliberately NO exchange between them.

export const Currency = z.enum(["CREDITS", "USDC"]);
export type Currency = z.infer<typeof Currency>;

// ── API DTOs ───────────────────────────────────────────────────────────────

export const PlayerProfileSchema = z.object({
  id: z.string().uuid(),
  handle: z.string().min(3).max(20),
  level: z.number().int().min(1),
  rep: z.number().int(),
  repTier: RepTier,
  creditsBalance: z.bigint().or(z.string()), // bigint serialized as string over JSON
  avatarUrl: z.string().url().nullable(),
});
export type PlayerProfile = z.infer<typeof PlayerProfileSchema>;

export const MatchTicketSchema = z.object({
  /** Signed JWT the client redeems with the realtime fleet. */
  ticket: z.string(),
  roomId: z.string(),
  realtimeUrl: z.string(),
  mode: RaceMode,
  carClass: CarClass,
});
export type MatchTicket = z.infer<typeof MatchTicketSchema>;

export const RaceResultEntrySchema = z.object({
  playerId: z.string().uuid(),
  finishPosition: z.number().int().min(1).max(8),
  finishTimeMs: z.number().int().nonnegative().nullable(), // null = DNF
  bestLapMs: z.number().int().nonnegative().nullable(),
  driftScore: z.number().int().nonnegative(),
  cleanRaceBonus: z.boolean(),
});
export type RaceResultEntry = z.infer<typeof RaceResultEntrySchema>;

/** Posted by the realtime server (service-authenticated) when a race ends. */
export const RaceResultReportSchema = z.object({
  raceId: z.string().uuid(),
  mode: RaceMode,
  trackId: z.string(),
  serverSeed: z.string(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  entries: z.array(RaceResultEntrySchema).min(1).max(8),
  /** Hash of the stored input-stream replay, for later anti-cheat re-simulation. */
  replayHash: z.string(),
});
export type RaceResultReport = z.infer<typeof RaceResultReportSchema>;
