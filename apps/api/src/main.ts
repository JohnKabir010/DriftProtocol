import "dotenv/config"; // must load BEFORE validateEnv reads process.env
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import compression from "compression";
import { validateEnv } from "./config/env";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/http-exception.filter";

async function bootstrap(): Promise<void> {
  // Validate all required env vars before doing anything else.
  const cfg = validateEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  // Security headers.
  app.use(
    helmet({
      contentSecurityPolicy: false, // managed by Next.js layer
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Gzip all JSON responses.
  app.use(compression());

  app.setGlobalPrefix("v1");

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const origins = (cfg.WEB_ORIGIN ?? "http://localhost:3000,http://localhost:3004")
    .split(",")
    .map((s) => s.trim());

  app.enableCors({
    origin: origins.length === 1 ? origins[0] : origins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-request-id"],
    exposedHeaders: ["x-request-id"],
    maxAge: 86400, // cache preflight for 24 h
  });

  // Trust first proxy (Railway / Fly sit behind a load balancer).
  app.set("trust proxy", 1);

  await app.listen(cfg.API_PORT);

  const logger = new Logger("Bootstrap");
  logger.log(`API listening on :${cfg.API_PORT} [${cfg.NODE_ENV}]`);

  // Graceful shutdown: drain in-flight requests before exit.
  const shutdown = async (signal: string) => {
    logger.log(`${signal} received — shutting down`);
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

void bootstrap();
