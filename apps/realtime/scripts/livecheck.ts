/**
 * Live end-to-end check: guest auth → quick ticket → join room → ready →
 * drive full-throttle until the race closes. Verifies bot spawning, input
 * acks, phase transitions, and the final standings broadcast.
 *
 *   pnpm exec tsx scripts/livecheck.ts [trackId]
 */
import { Client, type Room } from "colyseus.js";

const API = process.env.API_URL ?? "http://localhost:4000";
const RT = process.env.REALTIME_URL ?? "ws://localhost:2567";
const trackId = process.argv[2] ?? "skyline-loop";

function fail(msg: string): never {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

async function main() {
  const guest = (await (await fetch(`${API}/v1/auth/guest`, { method: "POST" })).json()) as {
    accessToken: string;
    handle: string;
  };
  console.log(`✓ guest session: ${guest.handle}`);

  const ticket = (await (
    await fetch(`${API}/v1/matchmaking/quick`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${guest.accessToken}` },
      body: JSON.stringify({ mode: "CIRCUIT", carClass: "C", trackId }),
    })
  ).json()) as { ticket: string; roomId: string; trackId: string; bots?: number; car?: { modelKey: string } };
  if (ticket.trackId !== trackId) fail(`ticket trackId ${ticket.trackId} != ${trackId}`);
  console.log(`✓ ticket: track=${ticket.trackId} bots=${ticket.bots} car=${ticket.car?.modelKey}`);

  const room: Room = await new Client(RT).joinOrCreate("race", {
    ticket: ticket.ticket,
    matchId: ticket.roomId,
    trackId: ticket.trackId,
  });
  console.log(`✓ joined room ${room.roomId}`);

  let phase = "WAITING";
  let seq = 0;
  let finished = false;

  room.onMessage("race.phase", (msg: { phase: string }) => {
    phase = msg.phase;
    console.log(`  phase → ${msg.phase}`);
  });

  room.onMessage(
    "race.result",
    (msg: { standings: Array<{ handle: string; position: number; finishTimeMs: number | null }> }) => {
      console.log("✓ race.result standings:");
      for (const s of msg.standings) {
        console.log(`    P${s.position}  ${s.handle}  ${s.finishTimeMs !== null ? (s.finishTimeMs / 1000).toFixed(1) + "s" : "DNF"}`);
      }
      finished = true;
    },
  );

  room.send("race.ready", {});

  // Drive: full throttle with mild steering correction is enough to follow
  // nothing — we mostly verify acks; bots do the real racing.
  const driver = setInterval(() => {
    if (phase === "RACING") {
      room.send("input.frame", { seq: ++seq, tick: 0, steer: 0, throttle: 1, brake: 0, handbrake: false, nitro: seq % 200 === 0 });
    }
  }, 33);

  // Snapshot after 10s of racing: car roster + ack + bot progress.
  setTimeout(() => {
    const cars: Array<{ handle: string; progress: number; lastAckSeq: number; playerId: string }> = [];
    room.state.cars.forEach((c: { handle: string; progress: number; lastAckSeq: number; playerId: string }) =>
      cars.push(c),
    );
    console.log(`✓ roster (${cars.length} cars):`);
    for (const c of cars) {
      const kind = c.playerId ? "human" : "bot  ";
      console.log(`    [${kind}] ${c.handle}  progress=${Math.round(c.progress)}m  ack=${c.lastAckSeq}`);
    }
    const bots = cars.filter((c) => !c.playerId);
    if (bots.length !== (ticket.bots ?? 0)) fail(`expected ${ticket.bots} bots, found ${bots.length}`);
    if (!bots.some((b) => b.progress > 20)) fail("bots are not making progress");
    const me = cars.find((c) => c.playerId);
    if (!me || me.lastAckSeq === 0) fail("server is not acking our inputs");
    console.log("✓ bots driving, inputs acked — waiting for race to close…");
  }, 14_000);

  const deadline = Date.now() + 5 * 60_000;
  while (!finished && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
  }
  clearInterval(driver);
  room.leave();
  if (!finished) fail("race did not close within 5 minutes");
  console.log("✅ full race flow OK");
  process.exit(0);
}

main().catch((err) => fail(String(err)));
