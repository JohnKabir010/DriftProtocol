# DRIFT PROTOCOL — Master Product Plan

> Web-based 3D multiplayer cyberpunk street racing with a player-driven underground economy, settled on Stellar. Gameplay is 100% offchain; Stellar/Soroban handles ownership, escrow, and high-value settlement — invisibly.

---

## 1. Executive Product Vision

**One-liner:** Need for Speed Underground meets EVE Online's economy, in the browser, with real-value settlement on Stellar.

**Thesis:** Racing games have great moment-to-moment gameplay but shallow economies. Blockchain games have economies but terrible gameplay. Drift Protocol is a *racing game first* — instant play, no wallet required, arcade-tight handling — where the top of the progression pyramid (rare cosmetics, high-stakes tournaments, district control, pink slips) settles in USDC on Stellar.

**Why Stellar:** sub-cent fees, 5s finality, native USDC, Soroban for escrow/treasury logic, and a payments-grade network that fits a *settlement layer* role (not a compute layer).

**North-star metric:** Weekly racers who complete ≥3 races. Secondary: % of weekly racers who touch the premium economy.

**Positioning rules (non-negotiable):**
- A player can install nothing, sign in with Google, and be racing in <60 seconds.
- Wallet connection is *never* required until a player initiates a premium action.
- Skill beats spend. Premium assets are cosmetic, access-based (tournament entry), or social (district banners) — never stat advantages.

## 2. Game Design Document (condensed GDD)

**Fantasy:** You are an underground street racer in Neo-Meridian, a rain-slicked neon megacity run by racing factions. Reputation is currency; districts are turf; the best racers own the night.

**Core loop:** Race → win Credits + Rep → upgrade car → unlock higher-stakes lobbies → join a faction → contest districts → enter USDC tournaments → trade rare assets.

**Session loop (8–12 min):** queue (≤30s) → lobby/banter (30s) → race (3–5 min) → results/payout/rep (30s) → garage tinkering or re-queue.

**Race modes:**
| Mode | Players | Stakes |
|---|---|---|
| Sprint | 2–8 | Credits |
| Circuit (laps) | 2–8 | Credits |
| Drift Trial | 1–8 async | Credits + leaderboard |
| Duel | 1v1 | Credits, Rep, or Pink Slip |
| Faction War | 4v4 | District influence |
| Tournament | bracket 8–64 | USDC pool |

**Progression:** Driver Level (XP, account-wide) → Rep Tiers (Street → Underground → Syndicate → Legend) gate lobby stakes and pink-slip access. Cars have classes D→S; matchmaking is class-bracketed.

**City:** 4 launch districts (Docklands, Neon Row, The Stacks, Skyline Loop), each with 2–3 track layouts, a visual identity, and a contestable control banner.

## 3. Gameplay Architecture

- **Deterministic-enough arcade physics** on both client (prediction) and server (authority) using Rapier (rapier3d on client, rapier3d-compat on Node server) at a fixed 30Hz simulation tick.
- Client samples input at 60–120Hz, sends compressed input frames (steer, throttle, brake, handbrake, nitro) with sequence numbers.
- Server simulates authoritatively, broadcasts snapshots at 15–20Hz; clients interpolate remote cars (100–150ms buffer) and reconcile their own car against server state.
- Race logic (checkpoints, laps, finish order, drift scoring, nitro economy) lives **only** on the server.
- Rendering decoupled from simulation: R3F render loop interpolates between physics states.

## 4. Multiplayer Architecture

- **Colyseus** rooms: `LobbyRoom` (matchmaking presence), `RaceRoom` (one per race, max 8 racers + 50 spectators), `SpectateRelay` (fan-out for big events).
- Authoritative server per room; rooms are stateless across races — results flush to the API via internal HTTP + Redis pub/sub.
- **Lag compensation:** input buffering with per-player clock sync (NTP-style ping/offset), server rewind window of 200ms for collision fairness.
- **Scaling:** Colyseus processes scale horizontally behind the Colyseus proxy/Redis presence driver; rooms pinned to a process; regional fleets (us-east, eu-west first).
- Region selection by latency probe at login; cross-region play allowed only in casual modes.

## 5. Frontend Architecture

```
apps/web (Next.js 14 App Router, TS strict)
├─ app/            routes: landing, /play, /garage, /market, /factions, /districts, /tournaments, /profile
├─ components/     ui/ (design system), hud/, game/ (R3F), market/, social/
├─ game/           engine: scene graph, car controller, input, netcode client, prediction/reconciliation
├─ stores/         zustand: session, race, garage, economy, settings
├─ lib/            api client (typed, from packages/shared), colyseus client, stellar (lazy-loaded)
└─ shaders/        neon/holo materials, post-processing
```
- Game canvas is a client-only island (`dynamic(..., { ssr: false })`); all meta/marketing pages are SSR/ISR for SEO.
- State: zustand for game state (fast, transient), TanStack Query for server data, no Redux.
- Stellar SDK + Freighter loaded lazily only when a premium action starts (keeps initial bundle small).

## 6. Backend Architecture

```
apps/api (NestJS, modular monolith → extractable services)
├─ auth/        social OAuth (Google/Discord) → JWT (access 15m / refresh 30d), optional wallet link (SEP-10 style challenge)
├─ players/     profiles, levels, rep
├─ garage/      cars, upgrades, loadouts
├─ races/       results ingestion (signed by realtime server), history, replays index
├─ matchmaking/ queue orchestration (Redis sorted sets), room ticketing
├─ economy/     credits ledger (double-entry), shop, rewards
├─ betting/     pools, odds, settlement orchestration
├─ factions/    membership, treasury views, wars
├─ districts/   influence, control epochs
├─ market/      listings, offers, onchain settlement bridge
├─ tournaments/ brackets, entries, USDC payout orchestration
├─ stellar/     horizon/rpc clients, tx building, sponsored accounts, webhook of chain events
└─ admin/       moderation, economy dials, feature flags
```
- **Event-driven core:** every economy mutation emits a domain event (Redis Streams → consumers: notifications, analytics, anti-fraud, chain-settlement worker). Credits ledger is append-only double-entry; balances are materialized views.
- Realtime servers authenticate to the API with mTLS/service tokens; only they may post race results.

## 7. Stellar Architecture

- **Custodial-first:** every player gets a backend-managed Stellar account (KMS-held keys) created lazily on first premium action — players never see seed phrases. Power users link Freighter and can withdraw assets to self-custody anytime.
- **Sponsored reserves + fee-bump transactions** so players never need XLM.
- USDC (circle.com issued) is the only money asset. Game Credits stay **offchain forever**.
- Stellar RPC (Soroban) for contract calls; Horizon for payments/history; a **chain-watcher worker** ingests events into Postgres so the game never blocks on chain reads.
- Testnet first; friendbot funding in dev; network passphrase/env-switched config.

## 8. Soroban Contract Architecture

| Contract | Purpose | Key invariants |
|---|---|---|
| `marketplace_escrow` | List/buy rare assets; holds asset + USDC atomically | No admin withdrawal path; timeout refunds |
| `tournament_pool` | Entry fees in, verified-result payout out | Payout only by oracle multisig (2-of-3 result signers); cap on rake |
| `faction_treasury` | Faction vault; deposits open, withdrawals via officer threshold | M-of-N officer auth, rate-limited withdrawals |
| `district_registry` | Records district control epochs + banner NFT-like entries | Only game-oracle can rotate control; history immutable |
| `asset_registry` | Ownership registry for rare cosmetics / legendary cars (SEP-41-ish tokens) | Mint capped per series; metadata hash onchain, art on CDN/IPFS |
| `rep_attest` | Periodic Merkle root of rep snapshots for portable proofs | Append-only roots, signed by game oracle |

- Contracts are **settlement and registry only** — no game logic. Game server is the oracle (multisig signers on separate infra). All contracts upgradeable behind a timelocked admin during beta, frozen at v1.0.

## 9. Database Schema (Postgres via Prisma — see `apps/api/prisma/schema.prisma`)

Core entities: `User`, `Player`, `WalletLink`, `Car`, `CarUpgrade`, `Race`, `RaceParticipant`, `ReplayMeta`, `LedgerEntry` (double-entry credits), `Bet`, `BetPool`, `Faction`, `FactionMember`, `District`, `DistrictEpoch`, `MarketListing`, `Trade`, `Tournament`, `TournamentEntry`, `Season`, `BattlePassProgress`, `ChainTx` (chain settlement journal), `ReputationEvent`.

Conventions: UUID PKs, `createdAt/updatedAt`, soft-delete only where legally needed, money as `BIGINT` minor units, all chain references in `ChainTx` with idempotency keys.

## 10. Matchmaking

- Redis sorted-set queues per (mode, region, car class, rep tier). Score = enqueue time.
- Matcher worker ticks every 2s: greedy bucket-fill, widening rep/class tolerance after 15s/30s, bot backfill in casual modes below liquidity threshold (clearly labeled).
- Skill rating: OpenSkill (Plackett-Luce) per mode; used for lobby seeding and bet odds priors, hidden from UI (Rep is the visible status number).
- Output: a room ticket (signed JWT: roomId, seat, class limits) the client redeems with the Colyseus fleet.

## 11. Betting System

- **Pari-mutuel pools only** (no house book → simpler legal posture, no odds risk). Pools per race: win pool, podium pool.
- Credits betting: available broadly, instant, offchain ledger.
- USDC betting: only on featured/tournament races, only in permitted jurisdictions (geo + KYC gate), settled via `tournament_pool`-style escrow.
- Spectators bet during a 60s pre-race window; live in-race betting deferred (oracle/latency abuse risk). Racers cannot bet on their own races (collusion control, enforced at ledger level + anomaly detection).
- Rake: 5% Credits pools (sink), 5% USDC pools (revenue, jurisdiction-dependent).

## 12. Marketplace

- Offchain order book UI; Credits items settle in the ledger instantly.
- Rare (onchain) assets: listing creates an escrow entry in `marketplace_escrow`; buy executes atomically (asset ↔ USDC); backend mirrors state from chain events. 2.5% fee.
- Price history, rarity metadata, search; anti-wash-trading heuristics (self-trade graphs, fee floors).

## 13. Economy Design (dual economy)

**Credits (offchain, soft):** Sources — race rewards (rank-scaled, diminishing daily), drift trials, daily contracts, season track. Sinks — upgrades, repairs (cosmetic-only "respray" sink), standard cosmetics, bet rake, faction dues, entry fees. Target: net-sink at top end, faucet-positive for new players. All faucet/sink dials are server-config (admin-tunable, no deploy).

**USDC (onchain, hard):** Enters via tournament entries, premium cosmetic sales, marketplace. Exits via tournament prizes, marketplace sales, withdrawal to self-custody. **No Credits↔USDC exchange** — the firewall that keeps Credits a game currency and avoids securities/money-transmission entanglement of the soft currency.

**Rare asset supply:** seasonal series, fixed mint caps, provable scarcity via `asset_registry`. Earnable through play (tournament trophies, district season rewards) *and* purchasable — earn paths always exist.

## 14. Faction System

- Create (Rep-gated + Credits fee), 50 members max, ranks (Boss/Officer/Racer/Prospect).
- Faction Rep = decayed sum of member contributions; unlocks treasury, district eligibility, faction liveries.
- Treasury: Credits side in ledger; USDC side in `faction_treasury` (officer M-of-N). Faction wars: scheduled 4v4 series, winner takes district influence.

## 15. District Ownership

- Each district has an **influence score** per faction, earned in Faction Wars and district playlists during weekly "Heat Cycles".
- Top faction at epoch close (weekly) controls the district for the next epoch: cosmetic banner takeover, 2% of district Credits race fees to faction treasury, exclusive faction garage instance. Recorded onchain in `district_registry` (bragging rights + history are permanent).
- Anti-snowball: influence decays 30%/epoch; defender handicap scales with consecutive holds.

## 16. Reputation System

- Rep is earned (race results, clean racing bonus, faction war wins, tournament placements) and *lost* (quits, ramming penalties, bans). Seasonal soft-reset (compress toward median).
- Visible tiers gate stakes; hidden OpenSkill does matching. Monthly Merkle snapshot to `rep_attest` → portable, verifiable racer history.

## 17–18. Garage & Upgrades

- Garage: car collection, loadout editor, livery editor (layered decals, neon underglow, holo wraps), photo mode.
- Upgrade tracks per car: Engine, Transmission, Tires, Nitro, ECU, Weight — each 5 tiers, Credits-priced, with class-rating budget (upgrading can promote a car's class → different bracket; prevents smurfing-by-build).
- Handling presets (Grip/Drift/Balanced) are free swaps — depth without pay-gates. Stat ceilings identical for all cars in a class; cars differ in *feel curves*, not power ceilings.

## 19. Anti-Cheat

- Server-authoritative physics is layer 1 (speed/teleport hacks impossible by construction).
- Layer 2 validation: input plausibility (rate, entropy), physics envelope checks (max accel/grip vs. loadout), checkpoint sequence enforcement, lap-time statistical outlier flags vs. ghost percentile bands.
- Layer 3: replay storage of input streams (tiny) → async re-simulation of suspicious races; betting anomaly detection (coordinated bets + tank patterns).
- Penalties ladder: shadow-flag → rewards hold → race voids → Rep strip → ban. All high-stakes payouts have a 10-min validation hold.

## 20. Security Architecture

- AuthN: OAuth → short-lived JWT; WS connections auth via one-time ticket, re-validated on room join. AuthZ: per-module guards, admin actions 2-person for economy dials.
- Custodial keys in KMS/HSM; signing service is a separate minimal process with allowlisted tx templates and per-account velocity limits.
- Oracles (result signers) on isolated infra, 2-of-3 multisig for any USDC-moving attestations.
- Standard hygiene: rate limits, input validation (zod/class-validator at every boundary), audit log on all economy mutations, dependency scanning, secrets in platform vaults, contract audits before mainnet.

## 21 & 46. Monetization & Revenue Model

1. **Battle Pass** ($9.99/season, cosmetic + Credits track) — primary, predictable.
2. **Premium cosmetics** (direct USD/USDC sales + rare drops).
3. **Tournament rake** (≤10% of USDC pools).
4. **Marketplace fee** (2.5% of secondary trades).
5. **Betting rake** (5%, jurisdiction-limited).
- Never sold: stats, upgrades, Rep, matchmaking advantage.

## 22. UI/UX Design System

- **Tokens:** bg `#0A0E17`, surface glass `rgba(16,24,40,.6)` + blur, neon cyan `#00F0FF`, magenta `#FF2E97`, volt `#CCFF00`, danger `#FF3B3B`; type: Orbitron/Chakra Petch (display) + Inter (UI); 4px grid; corner-cut card silhouettes.
- Components: HoloCard, NeonButton (charge animation), HUD gauges (speed arc, nitro bar, drift chain meter), Toast/Feed, StakeBadge, RepEmblem.
- Motion rules: 150–250ms UI transitions, GSAP for cinematic sequences (race intro flythrough, result slam), Framer Motion for layout/route transitions. 60fps HUD budget: HUD renders in DOM (not canvas) with transform-only animations.
- Onboarding flow: Landing → "Race Now" → guest session + tutorial sprint → social login prompt at first reward → wallet only at first premium action.

## 23–25. Animation / Audio / VFX

- **Animation:** car visual layer (suspension lean, wheel spin, steering rig) driven by physics state; GSAP timelines for countdown, finish, level-up; UI micro-interactions standardized in a `motion.ts` token file.
- **Audio:** WebAudio graph — synthwave/darksynth adaptive music (intensity layers by race position), engine synthesis (granular loops pitched by RPM), spatialized opponent audio, UI SFX set; ducking sidechain for callouts.
- **Shaders/VFX:** post stack (bloom, chromatic aberration on nitro, motion blur lite), wet-asphalt SSR-approximation (planar reflections on road only), neon emissive instancing, rain particles (GPU), speed lines, drift smoke (billboard particles with soft depth), holographic shader (fresnel + scanline) for UI-in-world.

## 26–28. Race Physics / Drift / Nitro

- **Physics:** arcade raycast-car model on Rapier rigid bodies — 4 ray "wheels", spring/damper suspension, slip-based lateral friction curve, speed-sensitive steering, downforce term. Tuned for ~5 min to fun, 50 hours to master.
- **Drift:** handbrake or lift-off oversteer initiates; while slip angle ∈ [15°, 65°] drift chain builds (multiplier × angle × speed); chain banks on straighten, drops on wall hit. Drift banks → nitro charge + style Rep.
- **Nitro:** bottle system (3 bottles); earned via drift, drafting, near-miss, clean overtakes. Boost = +35% accel + reduced drag for 2.5s; chaining drift→boost→drift is the skill ceiling. All values server-config.

## 29–30. Replay & Spectator

- **Replays:** store input streams + initial state + server seed (KBs, not video) → deterministic re-sim for playback and anti-cheat. Replay viewer = race scene in playback mode with free camera. Top-race replays auto-published to district feeds.
- **Spectator:** join `RaceRoom` as observer (snapshot-only channel, 10Hz, delayed 3s for bet integrity), director camera (auto-follows battles) + free cam; spectator count feeds "heat" UI.

## 31–33. Tournaments / Live Events / Seasons

- **Tournaments:** scheduled + faction-hosted; single-elim brackets 8–64; Credits or USDC entry; USDC pools escrowed in `tournament_pool` at reg-close; results signed by oracle trio → contract pays in one tx batch. Spectator hub with bracket UI + betting.
- **Live events:** server-config "Heat Nights" (2× rep windows), takeover events (one district, all modes), drop events (rare series minted to event winners).
- **Seasons:** 10 weeks; rep soft-reset, new battle pass, new rare series, district history archived onchain, balance patch.

## 34–36. API / WebSocket / Events

- **API:** REST (NestJS controllers) with OpenAPI; all DTOs zod-validated from `packages/shared` schemas; versioned `/v1`; idempotency keys on all money endpoints; cursor pagination.
- **WS events** (typed in `packages/shared/src/events.ts`): client→server `input.frame`, `race.ready`, `chat.msg`; server→client `state.snapshot`, `race.phase`, `race.result`, `bet.update`, `presence.*`. Binary snapshots (Colyseus schema), JSON for low-rate events.
- **Domain events** (Redis Streams): `race.completed`, `ledger.posted`, `bet.settled`, `listing.filled`, `district.flipped`, `chain.tx.confirmed` — every consumer idempotent, dead-letter stream + replayer.

## 37–39. Deployment / CI/CD / Observability

- **Deploy:** Vercel (web), Railway/Fly (api + realtime fleet + workers), Neon/Railway Postgres, Upstash/Railway Redis, Cloudflare R2 + CDN for assets, region-tagged realtime fleets.
- **CI/CD (GitHub Actions):** PR → typecheck/lint/test/build (turborepo cache) → preview deploys; main → staging; tagged → prod with migration gate (prisma migrate diff review). Contracts: separate pipeline — build, unit tests, testnet deploy, integration suite, manual promote.
- **Observability:** OpenTelemetry traces (api+realtime), Prometheus/Grafana (room counts, tick time p99, snapshot bytes/s, queue depth, ledger lag, chain-watcher lag), Sentry (web + node), PostHog (product analytics), structured pino logs → Loki. Alerting on: tick >40ms p99, matchmaking wait p95, settlement backlog, oracle disagreement.

## 40–41. QA / Load Testing

- Unit (vitest/jest) on physics math, ledger, odds, contract logic (Rust tests); integration on API with testcontainers (PG+Redis); contract tests between shared schemas and both apps; Playwright smoke on critical flows (login→race→reward); deterministic sim harness replaying recorded inputs across versions (physics regression).
- Load: k6 for REST; custom Colyseus bot fleet (N synthetic racers driving recorded inputs) — targets: 8-player room tick p99 <33ms, 500 concurrent rooms/node-fleet, snapshot bandwidth <20KB/s per client, matchmaking p95 <30s at 1k CCU.

## 42. Testnet Deployment Strategy

1. Deploy all 6 contracts to Stellar testnet via CI (soroban CLI), addresses in env-config service.
2. Faucet-funded custodial accounts; fake-USDC test asset mirroring Circle's testnet USDC.
3. Closed beta runs *entire* premium economy on testnet for ≥6 weeks; chaos drills (RPC outage, oracle signer loss, stuck tx) with documented runbooks.
4. Audit → mainnet pilot (cosmetics + one tournament) → progressive rollout.

## 43. Scaling Strategy

- Phase A (≤5k CCU): monolith API ×3, one realtime fleet/region, single PG + read replica.
- Phase B (≤50k CCU): extract matchmaking + settlement workers; Redis cluster; PG partitioning (races, ledger by month); CDN-everything; regional API.
- Phase C: ledger service extraction, ClickHouse for analytics/replay search, dedicated spectate relay tier for esports events.
- Cost guardrail: realtime $/CCU tracked weekly from day one.

## 44. MVP Scope (what ships first)

**In:** Google/Discord login, 1 district, 3 tracks, 6 cars, Sprint + Duel + Drift Trial, full netcode (8p), garage + upgrades + liveries (basic), Credits economy + ledger, Credits betting (spectator), Rep tiers, leaderboards, matchmaking, replays (storage only), Battle Pass v0. **Stellar in MVP:** testnet `asset_registry` + `marketplace_escrow` behind a "Founders Series" cosmetic drop — proves the rail without blocking the game.
**Out (post-MVP):** factions, districts ≥2, USDC tournaments, pink slips, spectator mode UI, mobile.

## 45. Post-MVP Roadmap

- **S1 (months 4–6):** Factions, Faction Wars, district control, spectator mode, USDC tournaments (testnet→mainnet pilot), marketplace GA.
- **S2 (7–9):** Pink slips, faction treasuries onchain, betting GA (geo-gated), replay theater, 2 new districts, creator liveries (rev-share).
- **S3 (10–12):** Mobile (touch controls + quality tiers), esports circuit, district season archives, rep attestation API for partners.

## 47. Legal & Gambling Risk Analysis (flagged for counsel — not legal advice)

- **Betting on others' races = gambling** in most jurisdictions. Mitigations: Credits-only betting at launch (closed-loop virtual currency, no cash-out — still review per-jurisdiction); USDC betting only behind geo-fence + KYC + license-dependent rollout (likely via a licensed partner); racers betting on *own* skill (entry-fee tournaments) generally fits skill-gaming carve-outs in many US states — but excluded states list required (e.g. AZ, AR, CT, DE, LA, MT, SC, SD, TN historically problematic for skill wagering).
- **Money transmission:** custodial USDC likely triggers MSB/VASP duties → use a regulated custody/ramp partner (e.g. Circle programmable wallets / licensed PSP) rather than self-custody of user funds.
- **No Credits↔USDC bridge** is the key structural firewall. No loot boxes with paid randomness (EU/Belgium/Netherlands). KYC/AML + sanctions screening on all USDC flows; Travel Rule via partner. Rare assets marketed as collectibles/access — no yield, no profit promises (securities posture). Counsel engagement is a pre-mainnet gate.

## 48. Development Timeline (lean team)

- **M1–2:** Phase 1–2 (foundation + racing prototype; fun-test gate at week 6 — if handling isn't fun, nothing else matters).
- **M3–4:** Phase 3 (matchmaking, garage, economy, betting-credits) → closed alpha (200 players).
- **M5:** Phase 4 + Stellar testnet integration (Founders drop) → open beta.
- **M6:** Phase 6–7 (polish, anti-cheat hardening, load tests, observability) → public launch (MVP scope).
- **M7–12:** Post-MVP roadmap S1–S2.

## 49–50. Team & Hiring Priorities

1. **Gameplay/3D engineer** (R3F + physics feel) — the game lives or dies here.
2. **Multiplayer/backend engineer** (Colyseus, NestJS, netcode).
3. **Technical artist** (shaders, VFX, art pipeline) — cyberpunk look on a browser budget.
4. **Smart contract engineer** (Rust/Soroban, part-time/contract until M4).
5. **Product designer** (UI/UX + economy instincts).
6. Post-funding: economy designer/data analyst, community manager, second gameplay engineer, DevOps/SRE.
- Founding stack: 4–5 people through MVP; contracts audited externally; art via outsourcing + kitbash with strong art direction.
