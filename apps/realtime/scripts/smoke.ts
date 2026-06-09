/**
 * End-to-end smoke test for the realtime server: signs a matchmaking ticket,
 * joins a race room as a client, readies up, waits for the countdown to
 * elapse, drives full-throttle for 3 seconds, and asserts the authoritative
 * car state moved and acked our inputs.
 *
 * Run with the server up:  pnpm --filter @drift/realtime smoke
 */
import { Client, Room } from "colyseus.js";
import jwt from "jsonwebtoken";
import { SIM_TICK_RATE } from "@drift/shared";

const SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-only";
const URL = process.env.REALTIME_URL ?? "ws://localhost:2567";

function fail(msg: string): never {
  console.error(`SMOKE FAIL: ${msg}`);
  process.exit(1);
}

async function waitForPhase(room: Room, phase: string, timeoutMs: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for phase ${phase}`)), timeoutMs);
    room.onMessage("race.phase", (msg: { phase: string }) => {
      if (msg.phase === phase) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

async function main(): Promise<void> {
  const ticket = jwt.sign({ sub: "00000000-0000-4000-8000-000000000001", roomId: "smoke" }, SECRET, {
    expiresIn: "60s",
  });

  const client = new Client(URL);
  const room = await client.create("race", { ticket });
  console.log(`joined room ${room.roomId} as ${room.sessionId}`);

  const racing = waitForPhase(room, "RACING", 10_000);
  room.send("race.ready", {});
  await racing;
  console.log("phase: RACING");

  // Drive full throttle for ~3s at the sim tick rate.
  let seq = 0;
  const ticks = SIM_TICK_RATE * 3;
  for (let i = 0; i < ticks; i++) {
    room.send("input.frame", {
      seq: ++seq,
      tick: i,
      steer: 0,
      throttle: 1,
      brake: 0,
      handbrake: false,
      nitro: false,
    });
    await new Promise((r) => setTimeout(r, 1000 / SIM_TICK_RATE));
  }
  await new Promise((r) => setTimeout(r, 300)); // let the last snapshot arrive

  const car = (room.state as any).cars.get(room.sessionId);
  if (!car) fail("no car in replicated state");
  const speed = Math.hypot(car.vx, car.vz);
  console.log(
    `car: speed=${speed.toFixed(1)} m/s ack=${car.lastAckSeq}/${seq} pos=(${car.x.toFixed(1)}, ${car.z.toFixed(1)}) progress=${car.progress.toFixed(1)}m`,
  );

  if (speed < 5) fail(`car barely moved (${speed.toFixed(2)} m/s)`);
  if (car.lastAckSeq === 0) fail("server never acked an input");
  if (car.progress <= 0) fail("no track progress registered");

  console.log("SMOKE PASS");
  await room.leave();
  process.exit(0);
}

main().catch((err) => fail(String(err)));
