import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(16),
  REALTIME_SERVICE_TOKEN: z.string().min(8),
  /** Required for operator endpoints (tournament create/settle). */
  ADMIN_API_TOKEN: z.string().min(16).optional(),
  // Optional — only required in production
  WEB_ORIGIN: z.string().optional(),
  /** Public base URL of this API — OAuth redirect_uri host. */
  API_PUBLIC_URL: z.string().url().optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  DISCORD_OAUTH_CLIENT_ID: z.string().optional(),
  DISCORD_OAUTH_CLIENT_SECRET: z.string().optional(),
  STELLAR_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
  STELLAR_HORIZON_URL: z.string().url().optional(),
  STELLAR_MASTER_SEED: z.string().length(64).optional(),
  STELLAR_USDC_ISSUER: z.string().optional(),
  STELLAR_USDC_ISSUER_SECRET: z.string().optional(), // owns the testnet USDC issuer account
  STELLAR_SPONSOR_SECRET: z.string().optional(),
  STELLAR_HOUSE_SECRET: z.string().optional(),        // tournament prize treasury
});

export type Env = z.infer<typeof EnvSchema>;

let _env: Env;

export function validateEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`\n[startup] Environment validation failed:\n${errors}\n`);
  }
  _env = result.data;
  return _env;
}

export function env(): Env {
  if (!_env) throw new Error("validateEnv() must be called first");
  return _env;
}
