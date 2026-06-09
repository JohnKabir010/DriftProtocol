import { describe, expect, it } from "vitest";
import { cloneCarState, createCarState, stepCar, CarInput } from "./carSim.js";
import { buildTrack, collideWithWalls, poseAtS } from "./track.js";
import { NEON_ROW_CIRCUIT } from "./tracks.js";
import { PredictionBuffer, SnapshotInterpolator, angleDelta } from "./netcode.js";

const track = buildTrack(NEON_ROW_CIRCUIT);
const DRIVE: CarInput = { steer: 0.3, throttle: 1, brake: 0, handbrake: false, nitro: false };

function startState() {
  const pose = poseAtS(track, 0);
  return createCarState(pose.x, pose.z, pose.yaw);
}

describe("prediction & reconciliation", () => {
  it("never rewinds when client and server simulations agree", () => {
    const client = new PredictionBuffer(startState(), track);
    const server = startState();

    for (let i = 0; i < 90; i++) {
      const seq = client.step(DRIVE);
      // Server consumes the same input one tick later (zero loss, fixed delay).
      stepCar(server, DRIVE);
      collideWithWalls(track, server);
      const rewound = client.reconcile(cloneCarState(server), seq);
      expect(rewound).toBe(false);
    }
  });

  it("rewinds and converges to authoritative state after divergence", () => {
    const client = new PredictionBuffer(startState(), track);
    const server = startState();

    // Build shared history — but the server LOSES one input frame and
    // simulates a neutral tick instead, so authoritative state diverges
    // from what the client predicted.
    let lastSeq = 0;
    for (let i = 0; i < 30; i++) {
      lastSeq = client.step(DRIVE);
      const serverInput = i === 10 ? { ...DRIVE, throttle: 0, steer: 0 } : DRIVE;
      stepCar(server, serverInput);
      collideWithWalls(track, server);
    }

    // Client keeps predicting 5 more ticks ahead of the server ack.
    const pendingInputs: CarInput[] = [];
    for (let i = 0; i < 5; i++) {
      pendingInputs.push(DRIVE);
      client.step(DRIVE);
    }

    const rewound = client.reconcile(cloneCarState(server), lastSeq);
    expect(rewound).toBe(true);

    // Expected truth: server state + the 5 pending inputs replayed.
    const expected = cloneCarState(server);
    for (const input of pendingInputs) {
      stepCar(expected, input);
      collideWithWalls(track, expected);
    }
    expect(client.state.x).toBeCloseTo(expected.x, 9);
    expect(client.state.z).toBeCloseTo(expected.z, 9);
    expect(client.state.yaw).toBeCloseTo(expected.yaw, 9);
  });
});

describe("snapshot interpolation", () => {
  it("lerps between snapshots and holds the last pose beyond the buffer", () => {
    const interp = new SnapshotInterpolator();
    interp.push({ t: 1000, x: 0, z: 0, yaw: 0 });
    interp.push({ t: 1100, x: 10, z: 0, yaw: Math.PI / 2 });

    const mid = interp.sample(1050)!;
    expect(mid.x).toBeCloseTo(5);
    expect(mid.yaw).toBeCloseTo(Math.PI / 4);

    const beyond = interp.sample(2000)!;
    expect(beyond.x).toBe(10);
  });

  it("angleDelta wraps across the ±π seam", () => {
    expect(angleDelta(-Math.PI + 0.1, Math.PI - 0.1)).toBeCloseTo(0.2);
  });
});
