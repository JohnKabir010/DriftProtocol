import { Injectable, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

/**
 * Shared Redis client + the two coordination primitives that make the API
 * safe to run with multiple replicas:
 *
 *  - tryLock: SET NX PX leader lock. Sweepers (betting, chain reconciler,
 *    matchmaking scan) take it per run, so exactly one replica does the work.
 *    Locks expire on their own — a crashed holder just skips a beat.
 *
 *  - one-time values with TTL (wallet link challenges) — previously an
 *    in-process Map, which both broke across replicas and lost state on
 *    deploy.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 2,
  });

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => undefined);
  }

  /** Acquire a short-lived leader lock. Not reentrant; never blocks. */
  async tryLock(key: string, ttlMs: number): Promise<boolean> {
    const res = await this.client.set(`lock:${key}`, "1", "PX", ttlMs, "NX");
    return res === "OK";
  }

  /** Store a single-use value with TTL (overwrites any previous one). */
  async putOnce(key: string, value: string, ttlMs: number): Promise<void> {
    await this.client.set(key, value, "PX", ttlMs);
  }

  /** Atomically read AND consume a single-use value. */
  async takeOnce(key: string): Promise<string | null> {
    return this.client.getdel(key);
  }
}
