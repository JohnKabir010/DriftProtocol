/**
 * Drift Protocol — Marketplace Escrow Deploy
 *
 * Creates a fresh deployer keypair, funds it via friendbot, builds the
 * marketplace-escrow Soroban contract, deploys it to Stellar testnet,
 * calls init(), and patches MARKETPLACE_ESCROW_CONTRACT_ID back into .env.
 *
 * Usage:
 *   pnpm tsx scripts/deploy-marketplace-escrow.ts
 *   pnpm tsx scripts/deploy-marketplace-escrow.ts --fee-bps 250 --fee-recipient G...
 */

import { Keypair } from "@stellar/stellar-sdk";
import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

// ── Paths & constants ─────────────────────────────────────────────────────────

const ROOT = join(__dirname, "..");
const CONTRACT_DIR = join(ROOT, "packages", "contracts", "marketplace-escrow");
const WASM_RELEASE_DIR = join(
  ROOT, "packages", "contracts", "target", "wasm32-unknown-unknown", "release",
);
const WASM_PATH = join(WASM_RELEASE_DIR, "marketplace_escrow.wasm");
const OPTIMIZED_WASM_PATH = join(WASM_RELEASE_DIR, "marketplace_escrow.optimized.wasm");
const ENV_PATH = join(ROOT, ".env");

const FRIENDBOT_URL = "https://friendbot.stellar.org";
const HORIZON_URL   = "https://horizon-testnet.stellar.org";
// Circle testnet USDC issuer — stable well-known address for Stellar testnet
const CIRCLE_USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const DEFAULT_FEE_BPS    = 250; // 2.5%

// ── Arg parsing ───────────────────────────────────────────────────────────────

function parseArgs(): { feeBps: number; feeRecipient: string | null } {
  const args = process.argv.slice(2);
  let feeBps = DEFAULT_FEE_BPS;
  let feeRecipient: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--fee-bps"       && args[i + 1]) feeBps       = parseInt(args[++i], 10);
    if (args[i] === "--fee-recipient" && args[i + 1]) feeRecipient = args[++i];
  }
  if (Number.isNaN(feeBps) || feeBps < 0 || feeBps > 500)
    throw new Error("--fee-bps must be 0–500 (capped at 5% by contract)");
  return { feeBps, feeRecipient };
}

// ── .env helpers ──────────────────────────────────────────────────────────────

function readEnvVar(key: string): string | null {
  if (!existsSync(ENV_PATH)) return null;
  for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
    const m = line.match(new RegExp(`^${key}=(.+)$`));
    if (m) return m[1].trim();
  }
  return null;
}

function patchEnv(key: string, value: string): void {
  let content = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
  const regex = new RegExp(`^(${key}=).*$`, "m");
  content = regex.test(content)
    ? content.replace(regex, `$1${value}`)
    : content.trimEnd() + `\n${key}=${value}\n`;
  writeFileSync(ENV_PATH, content, "utf8");
}

// ── Shell helper ──────────────────────────────────────────────────────────────

function stellar(args: string, cwd = ROOT): string {
  return execSync(`stellar ${args}`, { cwd, stdio: ["pipe", "pipe", "inherit"] })
    .toString()
    .trim();
}

// ── Friendbot / Horizon ───────────────────────────────────────────────────────

async function fundViaFriendbot(publicKey: string): Promise<void> {
  const res = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`);
  if (!res.ok) {
    const body = await res.text();
    if (body.includes("createAccountAlreadyExist")) return; // idempotent
    throw new Error(`Friendbot failed for ${publicKey}: ${res.status} ${body}`);
  }
}

async function waitForAccount(publicKey: string, retries = 15): Promise<void> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(`${HORIZON_URL}/accounts/${publicKey}`);
    if (res.ok) return;
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Account ${publicKey} never appeared on Horizon`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🚀  Drift Protocol — Marketplace Escrow Deploy\n");

  const { feeBps, feeRecipient: argFeeRecipient } = parseArgs();

  // ── 1. Generate deployer keypair ───────────────────────────────────────────
  console.log("🔑  Generating deployer keypair…");
  const deployer = Keypair.random();
  console.log(`    Public : ${deployer.publicKey()}`);
  console.log(`    Secret : ${deployer.secret().slice(0, 4)}${"*".repeat(52)}\n`);

  // ── 2. Fund via friendbot ──────────────────────────────────────────────────
  console.log("💸  Funding deployer via friendbot (testnet)…");
  await fundViaFriendbot(deployer.publicKey());
  process.stdout.write("⏳  Waiting for account on Horizon ");
  await waitForAccount(deployer.publicKey());
  console.log(" ✓\n");

  // ── 3. Build WASM ─────────────────────────────────────────────────────────
  console.log("🔨  Building marketplace-escrow WASM (release)…");
  execSync("cargo build --target wasm32-unknown-unknown --release", {
    cwd: CONTRACT_DIR,
    stdio: "inherit",
  });
  console.log(`    ✓ Built: ${WASM_PATH}\n`);

  // ── 4. Optimize WASM ──────────────────────────────────────────────────────
  console.log("✂️   Optimizing WASM…");
  try {
    stellar(`contract optimize --wasm "${WASM_PATH}"`);
    console.log(`    ✓ Optimized: ${OPTIMIZED_WASM_PATH}\n`);
  } catch {
    console.log("    ⚠  stellar contract optimize unavailable — using unoptimized WASM\n");
  }
  const wasmToUse = existsSync(OPTIMIZED_WASM_PATH) ? OPTIMIZED_WASM_PATH : WASM_PATH;

  // ── 5. Deploy contract ────────────────────────────────────────────────────
  console.log("📤  Deploying contract to testnet…");
  const contractId = stellar(
    `contract deploy \
      --wasm "${wasmToUse}" \
      --source-account "${deployer.secret()}" \
      --network testnet \
      --ignore-checks`,
  );
  if (!contractId || contractId.length < 32) {
    throw new Error(`Unexpected deploy output: "${contractId}"`);
  }
  console.log(`    ✓ Contract ID: ${contractId}\n`);

  // ── 6. Resolve USDC Stellar Asset Contract (SAC) ID ───────────────────────
  const usdcIssuer = readEnvVar("STELLAR_USDC_ISSUER") ?? CIRCLE_USDC_ISSUER;
  console.log(`🪙  Resolving USDC SAC for issuer ${usdcIssuer.slice(0, 12)}…`);
  const usdcContractId = stellar(
    `contract id asset --asset "USDC:${usdcIssuer}" --network testnet`,
  );
  console.log(`    ✓ USDC SAC: ${usdcContractId}\n`);

  // ── 7. Init contract ──────────────────────────────────────────────────────
  const feeRecipient = argFeeRecipient ?? deployer.publicKey();
  console.log("⚙️   Initialising contract…");
  console.log(`    usdc          : ${usdcContractId}`);
  console.log(`    fee_recipient : ${feeRecipient}`);
  console.log(`    fee_bps       : ${feeBps} (${(feeBps / 100).toFixed(2)}%)\n`);

  stellar(
    `contract invoke \
      --id "${contractId}" \
      --source-account "${deployer.secret()}" \
      --network testnet \
      -- init \
        --usdc "${usdcContractId}" \
        --fee-recipient "${feeRecipient}" \
        --fee-bps "${feeBps}"`,
  );
  console.log("    ✓ Contract initialised\n");

  // ── 8. Patch .env ─────────────────────────────────────────────────────────
  patchEnv("MARKETPLACE_ESCROW_CONTRACT_ID", contractId);
  console.log(`✅  Patched .env  →  MARKETPLACE_ESCROW_CONTRACT_ID=${contractId}\n`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("📋  Deployment summary");
  console.log(`    Contract ID   : ${contractId}`);
  console.log(`    Deployer      : ${deployer.publicKey()}`);
  console.log(`    USDC SAC      : ${usdcContractId}`);
  console.log(`    Fee recipient : ${feeRecipient}`);
  console.log(`    Fee           : ${feeBps} bps (${(feeBps / 100).toFixed(2)}%)`);
  console.log(`    Network       : testnet`);
  console.log(`
📖  Next steps:
    List an asset:
      stellar contract invoke --id ${contractId} --network testnet \\
        -- list --seller G... --asset-contract C... --amount 1 --price-usdc 1000000 --ttl-ledgers 17280

    Buy a listing:
      stellar contract invoke --id ${contractId} --network testnet \\
        -- buy --buyer G... --listing-id 0
`);
}

main().catch((err) => {
  console.error("\n❌  Deploy failed:", err.message ?? err);
  process.exit(1);
});
