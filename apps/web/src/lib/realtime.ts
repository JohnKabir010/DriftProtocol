"use client";

import { Client, Room } from "colyseus.js";
import type { InputFrame } from "@drift/shared";

/**
 * Realtime client wrapper. Phase 2 wires this into PlayerCar for
 * prediction/reconciliation; Phase 1 exposes connect + input send.
 */
export class RealtimeClient {
  private client: Client;
  private room: Room | null = null;

  constructor(url = process.env.NEXT_PUBLIC_REALTIME_URL ?? "ws://localhost:2567") {
    this.client = new Client(url);
  }

  /** Join a race room with a matchmaking ticket issued by the API. */
  async joinRace(ticket: string, roomId: string): Promise<Room> {
    this.room = await this.client.joinById(roomId, { ticket }).catch(async () => {
      // Quick-race rooms are created on demand in dev.
      return this.client.create("race", { ticket });
    });
    return this.room;
  }

  sendInput(frame: InputFrame): void {
    this.room?.send("input.frame", frame);
  }

  ready(): void {
    this.room?.send("race.ready", {});
  }

  leave(): void {
    void this.room?.leave();
    this.room = null;
  }
}
