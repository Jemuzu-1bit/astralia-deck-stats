import assert from "node:assert/strict";
import { test } from "node:test";
import { MemoryBackend, RoomStore, decodeRoom, encodeRoom } from "./roomStore.js";
import { PRESENCE_TTL_MS, ROOM_TTL_MS } from "./roomLifecycle.js";
import { publicState } from "./roomState.js";

async function setup() {
  let now = 1000;
  const backend = new MemoryBackend({ now: () => now });
  const store = new RoomStore(backend, { now: () => now });
  const actors = {};
  const command = async (id, code, event, payload) => {
    actors[id] ??= { id, data: {} };
    const result = await store.execute(code, actors[id], event, payload);
    actors[id].data = result.data;
    return result;
  };
  const read = async (code) => decodeRoom(await backend.get(code));
  return { backend, store, command, read, advance: (ms) => { now += ms; } };
}

test("discovery exposes only public room summaries, keeping legacy and private rooms invite-only", async () => {
  const f = await setup();
  await f.command("legacy", "AAA111", "lobby:host", "Legacy host");
  await f.command("private", "BBB222", "lobby:host", { name: "Private host", visibility: "private", roomName: "Secret table" });
  await f.command("public", "CCC333", "lobby:host", { name: "Public host", visibility: "public", roomName: "Casual matches" });
  assert.equal((await f.read("AAA111")).visibility, "private");
  assert.deepEqual(await f.store.listPublicRooms(), [{
    code: "CCC333", roomName: "Casual matches", hostName: "Public host",
    playerCount: 1, spectatorCount: 0, started: false, createdAt: 1000,
  }]);
  // Old persisted rooms do not acquire public visibility during an upgrade.
  const legacy = await f.read("AAA111");
  delete legacy.visibility;
  delete legacy.roomName;
  await f.backend.commit("AAA111", await f.backend.get("AAA111"), encodeRoom(legacy), ROOM_TTL_MS, []);
  assert.equal(publicState(legacy, "legacy").visibility, "private");
  assert.equal((await f.store.listPublicRooms()).length, 1);
  await f.command("private-guest", "BBB222", "lobby:join", { code: "BBB222", name: "Invited player" });
  await f.command("private-viewer", "BBB222", "lobby:watch", { code: "BBB222" });
  assert.equal((await f.read("BBB222")).guest.name, "Invited player");
  assert.equal((await f.read("BBB222")).spectators.size, 1);
  assert.equal((await f.store.listPublicRooms()).length, 1);
});

test("public rooms update occupancy, enforce two seats and host start, and allow late spectators", async () => {
  const f = await setup();
  const code = "ABC123";
  await f.command("host", code, "lobby:host", { name: "Alice", visibility: "public", roomName: "Practice" });
  await f.command("guest", code, "lobby:join", { code, name: "Bob" });
  const full = await f.command("extra", code, "lobby:join", { code, name: "Third player" });
  assert.ok(full.effects.some((effect) => effect.payload === "This lobby is full."));
  assert.equal((await f.store.listPublicRooms())[0].playerCount, 2);
  for (const id of ["host", "guest"]) await f.command(id, code, "lobby:setDeck", {
    deckId: id, deckName: "Private deck name", protagonistId: id === "host" ? "dcs_02_002ex" : "dcs_02_001ex",
    personaCards: [], mainDeckCards: [{ id: "secret-card", qty: 40 }],
  });
  await f.command("guest", code, "lobby:startRequest");
  assert.equal((await f.read(code)).started, false, "the guest cannot start even when both decks are selected");
  await f.command("guest", code, "disconnect");
  await f.command("host", code, "lobby:startRequest");
  assert.equal((await f.read(code)).started, false, "a disconnected guest cannot be started into a match");
  const guest = (await f.read(code)).guest;
  await f.command("returning-guest", code, "lobby:resume", { code, token: guest.token });
  assert.equal((await f.read(code)).started, false, "the match never starts automatically");
  await f.command("host", code, "lobby:startRequest");
  assert.equal((await f.store.listPublicRooms())[0].started, true);
  await f.command("viewer", code, "lobby:watch", { code });
  const latePlayer = await f.command("late-player", code, "lobby:join", { code, name: "Late" });
  assert.ok(latePlayer.effects.some((effect) => effect.payload === "This match has started. Watch it instead."));
  const summary = (await f.store.listPublicRooms())[0];
  assert.equal(summary.spectatorCount, 1);
  assert.ok(!JSON.stringify(summary).includes("secret"));
  assert.equal(summary.host, undefined);
  await f.command("host", code, "lobby:leave");
  assert.deepEqual(await f.store.listPublicRooms(), []);
});

test("discovery omits disconnected, expired and closed hosts, and stale spectators", async () => {
  const f = await setup();
  const code = "ABC123";
  await f.command("host", code, "lobby:host", { name: "Alice", visibility: "public", roomName: "Practice" });
  await f.command("viewer", code, "lobby:watch", { code });
  f.advance(PRESENCE_TTL_MS + 1);
  assert.deepEqual(await f.store.listPublicRooms(), [], "expired presence is respected before maintenance runs");
  await f.command("host", code, "heartbeat");
  assert.equal((await f.store.listPublicRooms())[0].spectatorCount, 0);
  await f.command("host", code, "disconnect");
  assert.deepEqual(await f.store.listPublicRooms(), []);
  f.advance(ROOM_TTL_MS + 1);
  assert.deepEqual(await f.store.listPublicRooms(), []);
});
