import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../infra/redis.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check() {
    const start = Date.now();
    let db: "ok" | "error" = "ok";
    let cache: "ok" | "error" = "ok";

    const [dbResult, redisResult] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.client.ping(),
    ]);

    if (dbResult.status === "rejected") db = "error";
    if (redisResult.status === "rejected" || (redisResult.status === "fulfilled" && redisResult.value !== "PONG")) {
      cache = "error";
    }

    const allOk = db === "ok" && cache === "ok";

    return {
      status: allOk ? "ok" : "degraded",
      uptime: Math.round(process.uptime()),
      services: { db, cache },
      latencyMs: Date.now() - start,
      version: process.env["npm_package_version"] ?? "0.1.0",
      env: process.env["NODE_ENV"],
    };
  }
}
