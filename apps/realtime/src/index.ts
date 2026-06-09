import "dotenv/config";
import http from "node:http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { RaceRoom } from "./rooms/RaceRoom";

const port = Number(process.env.REALTIME_PORT ?? 2567);

const server = new Server({
  transport: new WebSocketTransport({ server: http.createServer() }),
  // Production: add RedisDriver + RedisPresence for horizontal scaling.
});

server.define("race", RaceRoom);

void server.listen(port).then(() => {
  console.log(`[realtime] listening on :${port}`);
});
