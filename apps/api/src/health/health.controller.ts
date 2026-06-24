import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const start = Date.now();
    let db: "ok" | "error" = "ok";

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = "error";
    }

    return {
      status: db === "ok" ? "ok" : "degraded",
      uptime: process.uptime(),
      db,
      latencyMs: Date.now() - start,
      version: process.env["npm_package_version"] ?? "0.1.0",
      env: process.env["NODE_ENV"],
    };
  }
}
