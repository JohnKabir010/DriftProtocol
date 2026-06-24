-- CreateEnum
CREATE TYPE "RepTier" AS ENUM ('STREET', 'UNDERGROUND', 'SYNDICATE', 'LEGEND');

-- CreateEnum
CREATE TYPE "CarClass" AS ENUM ('D', 'C', 'B', 'A', 'S');

-- CreateEnum
CREATE TYPE "UpgradeSlot" AS ENUM ('ENGINE', 'TRANSMISSION', 'TIRES', 'NITRO', 'ECU', 'WEIGHT');

-- CreateEnum
CREATE TYPE "RaceMode" AS ENUM ('SPRINT', 'CIRCUIT', 'DRIFT_TRIAL', 'DUEL', 'FACTION_WAR', 'TOURNAMENT');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('CREDITS', 'USDC');

-- CreateEnum
CREATE TYPE "PoolStatus" AS ENUM ('OPEN', 'LOCKED', 'SETTLED', 'VOIDED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'FILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChainStatus" AS ENUM ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "authProvider" TEXT NOT NULL,
    "authSubject" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "handle" VARCHAR(20) NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "rep" INTEGER NOT NULL DEFAULT 0,
    "repTier" "RepTier" NOT NULL DEFAULT 'STREET',
    "custodialAccountId" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Car" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "modelKey" TEXT NOT NULL,
    "carClass" "CarClass" NOT NULL,
    "nickname" VARCHAR(24),
    "livery" JSONB NOT NULL,
    "onchainId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Car_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarUpgrade" (
    "id" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "slot" "UpgradeSlot" NOT NULL,
    "tier" INTEGER NOT NULL,

    CONSTRAINT "CarUpgrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Race" (
    "id" TEXT NOT NULL,
    "mode" "RaceMode" NOT NULL,
    "trackId" TEXT NOT NULL,
    "serverSeed" TEXT NOT NULL,
    "replayHash" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Race_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaceParticipant" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "carId" TEXT NOT NULL,
    "finishPosition" INTEGER,
    "finishTimeMs" INTEGER,
    "bestLapMs" INTEGER,
    "driftScore" INTEGER NOT NULL DEFAULT 0,
    "cleanRace" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RaceParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "playerId" TEXT,
    "currency" "Currency" NOT NULL,
    "amount" BIGINT NOT NULL,
    "journalId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetPool" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "status" "PoolStatus" NOT NULL DEFAULT 'OPEN',
    "rakeBps" INTEGER NOT NULL DEFAULT 500,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "selectionId" TEXT NOT NULL,
    "stake" BIGINT NOT NULL,
    "payout" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faction" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(32) NOT NULL,
    "tag" VARCHAR(5) NOT NULL,
    "rep" INTEGER NOT NULL DEFAULT 0,
    "treasuryContractId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Faction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactionMember" (
    "id" TEXT NOT NULL,
    "factionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "rank" TEXT NOT NULL DEFAULT 'PROSPECT',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactionMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistrictEpoch" (
    "id" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "epochNumber" INTEGER NOT NULL,
    "controllingFactionId" TEXT,
    "influence" JSONB NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "chainTxId" TEXT,

    CONSTRAINT "DistrictEpoch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketListing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "assetRef" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "price" BIGINT NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "escrowEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChainTx" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "txHash" TEXT,
    "status" "ChainStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChainTx_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" "RaceMode" NOT NULL,
    "currency" "Currency" NOT NULL,
    "entryFee" BIGINT NOT NULL,
    "bracketSize" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REGISTRATION',
    "poolContractId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReputationEvent" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReputationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_authProvider_authSubject_key" ON "User"("authProvider", "authSubject");

-- CreateIndex
CREATE UNIQUE INDEX "WalletLink_publicKey_key" ON "WalletLink"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "Player_userId_key" ON "Player"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_handle_key" ON "Player"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "Car_onchainId_key" ON "Car"("onchainId");

-- CreateIndex
CREATE UNIQUE INDEX "CarUpgrade_carId_slot_key" ON "CarUpgrade"("carId", "slot");

-- CreateIndex
CREATE INDEX "Race_mode_startedAt_idx" ON "Race"("mode", "startedAt");

-- CreateIndex
CREATE INDEX "RaceParticipant_playerId_idx" ON "RaceParticipant"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "RaceParticipant_raceId_playerId_key" ON "RaceParticipant"("raceId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_idempotencyKey_key" ON "LedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "LedgerEntry_playerId_currency_idx" ON "LedgerEntry"("playerId", "currency");

-- CreateIndex
CREATE INDEX "LedgerEntry_journalId_idx" ON "LedgerEntry"("journalId");

-- CreateIndex
CREATE INDEX "Bet_poolId_idx" ON "Bet"("poolId");

-- CreateIndex
CREATE UNIQUE INDEX "Faction_name_key" ON "Faction"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Faction_tag_key" ON "Faction"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "Faction_treasuryContractId_key" ON "Faction"("treasuryContractId");

-- CreateIndex
CREATE UNIQUE INDEX "FactionMember_playerId_key" ON "FactionMember"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "District_key_key" ON "District"("key");

-- CreateIndex
CREATE UNIQUE INDEX "DistrictEpoch_chainTxId_key" ON "DistrictEpoch"("chainTxId");

-- CreateIndex
CREATE UNIQUE INDEX "DistrictEpoch_districtId_epochNumber_key" ON "DistrictEpoch"("districtId", "epochNumber");

-- CreateIndex
CREATE INDEX "MarketListing_status_assetType_idx" ON "MarketListing"("status", "assetType");

-- CreateIndex
CREATE UNIQUE INDEX "ChainTx_txHash_key" ON "ChainTx"("txHash");

-- CreateIndex
CREATE UNIQUE INDEX "ChainTx_idempotencyKey_key" ON "ChainTx"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ChainTx_status_idx" ON "ChainTx"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Season_number_key" ON "Season"("number");

-- CreateIndex
CREATE INDEX "ReputationEvent_playerId_createdAt_idx" ON "ReputationEvent"("playerId", "createdAt");

-- AddForeignKey
ALTER TABLE "WalletLink" ADD CONSTRAINT "WalletLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Car" ADD CONSTRAINT "Car_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarUpgrade" ADD CONSTRAINT "CarUpgrade_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceParticipant" ADD CONSTRAINT "RaceParticipant_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceParticipant" ADD CONSTRAINT "RaceParticipant_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetPool" ADD CONSTRAINT "BetPool_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "BetPool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactionMember" ADD CONSTRAINT "FactionMember_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactionMember" ADD CONSTRAINT "FactionMember_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistrictEpoch" ADD CONSTRAINT "DistrictEpoch_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistrictEpoch" ADD CONSTRAINT "DistrictEpoch_controllingFactionId_fkey" FOREIGN KEY ("controllingFactionId") REFERENCES "Faction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReputationEvent" ADD CONSTRAINT "ReputationEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
