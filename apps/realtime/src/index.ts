import "dotenv/config";
import http from "node:http";
import { Server } from "@colyseus/core";
import { RedisDriver } from "@colyseus/redis-driver";
import { RedisPresence } from "@colyseus/redis-presence";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { RaceRoom } from "./rooms/RaceRoom";

if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.length < 16) {
  console.error("[realtime] JWT_ACCESS_SECRET must be set (>=16 chars) — refusing to start");
  process.exit(1);
}

const port = Number(process.env.REALTIME_PORT ?? 2567);

// With REDIS_URL, room listings + presence live in Redis so multiple realtime
// instances form one fleet (matchId filterBy then works across instances).
const redisUrl = process.env.REDIS_URL;

const server = new Server({
  transport: new WebSocketTransport({ server: http.createServer() }),
  ...(redisUrl
    ? { presence: new RedisPresence(redisUrl), driver: new RedisDriver(redisUrl) }
    : {}),
});

// filterBy(matchId): every client carrying the same matchmaking roomId lands
// in the SAME room instance — this is what makes matchmade lobbies real.
server.define("race", RaceRoom).filterBy(["matchId"]);

void server.listen(port).then(() => {
  console.log(`[realtime] listening on :${port}`);
});

const shutdown = async (signal: string) => {
  console.log(`[realtime] ${signal} received — shutting down`);
  await server.gracefullyShutdown(true).catch(() => undefined);
  process.exit(0);
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
