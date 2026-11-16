import assert from "node:assert/strict";
import { test } from "node:test";
import { MemoryBackend, RoomStore, decodeRoom, encodeRoom } from "./roomStore.js";
import { ROOM_TTL_MS, PRESENCE_TTL_MS } from "./roomLifecycle.js";

async function fixture(backend = new MemoryBackend(), now = Date.now) {
  const store = new RoomStore(backend, { now });
  const actors = {
    host: { id: "host-socket", data: {} }, guest: { id: "guest-socket", data: {} },
    viewer: { id: "viewer-socket", data: {} },
  };
  const code = "ABC123";
  async function command(role, event, payload, id) {
    const result = await store.execute(code, actors[role], event, payload, id);
    actors[role].data = result.data;
    return result;
  }
  await command("host", "lobby:host", "Host");
  await command("guest", "lobby:join", { code, name: "Guest" });
  await command("viewer", "lobby:watch", { code });
  for (const role of ["host", "guest"]) await command(role, "lobby:setDeck", {
    deckId: role, protagonistId: role === "host" ? "dcs_02_002ex" : "dcs_02_001ex",
    personaCards: [], mainDeckCards: [{ id: `${role}-secret`, qty: 40 }],
  });
  await command("host", "lobby:startRequest");
  return { store, backend, actors, code, command, read: async () => decodeRoom(await backend.get(code)) };
}

test("concurrent writers retain both players' actions and publish only committed private projections", async () => {
  const f = await fixture();
  const otherStore = new RoomStore(f.backend);
  const messages = [];
  f.backend.subscribe((effects) => messages.push(...effects));
  await Promise.all(Array.from({ length: 20 }, (_, index) => {
    const role = index % 2 ? "host" : "guest";
    return (index % 3 ? f.store : otherStore).execute(f.code, f.actors[role], "game:deckAction", { action: "draw", count: 1 }, `draw-${index}`);
  }));
  const room = await f.read();
  assert.equal(room.host.table.hand.length, 15);
  assert.equal(room.guest.table.hand.length, 15);
  const states = messages.filter((message) => message.event === "lobby:state");
  assert.equal(states.length, 60, "failed compare-and-swap attempts must not broadcast");
  const revisions = states.filter((message) => message.ids[0] === f.actors.host.id).map((message) => message.payload.revision);
  assert.equal(new Set(revisions).size, 20);
  assert.deepEqual(revisions, [...revisions].sort((a, b) => a - b));
  for (const message of states) {
    const state = message.payload;
    assert.equal(state.host.token, undefined);
    assert.equal(state.guest.token, undefined);
    assert.equal(state.commands, undefined);
    if (state.viewerRole !== "host") assert.equal(state.host.table.hand.length, 0);
    if (state.viewerRole !== "guest") assert.equal(state.guest.table.hand.length, 0);
  }
});

test("a saved command is not applied twice after resume on another instance", async () => {
  const f = await fixture();
  await f.command("host", "game:deckAction", { action: "draw", count: 1 }, "lost-ack");
  const before = await f.read();
  const otherStore = new RoomStore(f.backend);
  const replacement = { id: "new-host-socket", data: {} };
  const resumed = await otherStore.execute(f.code, replacement, "lobby:resume", { code: f.code, token: before.host.token });
  replacement.data = resumed.data;
  await otherStore.execute(f.code, replacement, "game:deckAction", { action: "draw", count: 1 }, "lost-ack");
  await f.command("host", "disconnect");
  await f.command("host", "lobby:leave");
  const after = await f.read();
  assert.equal(after.host.socketId, replacement.id);
  assert.equal(after.host.connected, true);
  assert.deepEqual(after.host.table, before.host.table);
  assert.ok(after.guest, "an obsolete host connection must not remove the guest");
});

test("timestamps clean expired presence and arrows after a process disappears", async () => {
  let time = Date.now();
  const now = () => time;
  const f = await fixture(new MemoryBackend({ now }), now);
  const room = await f.read();
  room.host.table.protagonist[0].targetUid = "target";
  room.host.table.protagonist[0].targetExpiresAt = time + 5000;
  const raw = await f.backend.get(f.code);
  await f.backend.commit(f.code, raw, encodeRoom(room), ROOM_TTL_MS + PRESENCE_TTL_MS, []);
  time += PRESENCE_TTL_MS + 1;
  const replacementStore = new RoomStore(f.backend, { now });
  await replacementStore.execute(f.code, { id: "", data: {} }, "maintenance");
  const cleaned = await f.read();
  assert.equal(cleaned.host.connected, false);
  assert.equal(cleaned.guest.connected, false);
  assert.equal(cleaned.spectators.size, 0);
  assert.equal(cleaned.host.table.protagonist[0].targetUid, undefined);
  time += ROOM_TTL_MS + 1;
  assert.equal(await f.read(), null);
});

test("heartbeats preserve an idle connected game and explicit host leave deletes it", async () => {
  let time = Date.now();
  const now = () => time;
  const f = await fixture(new MemoryBackend({ now }), now);
  for (let i = 0; i < 70; i++) {
    time += 30000;
    await f.command("host", "heartbeat");
  }
  assert.ok(await f.read(), "a connected game must outlive the 30 minute idle expiry");
  await f.command("host", "lobby:leave");
  assert.equal(await f.read(), null);
});

test("only one simultaneous guest claims a room and invalid tokens cannot resume", async () => {
  const backend = new MemoryBackend();
  const store = new RoomStore(backend);
  await store.execute("ABC123", { id: "host", data: {} }, "lobby:host", "Host");
  const results = await Promise.all(["guest1", "guest2"].map((id) =>
    store.execute("ABC123", { id, data: {} }, "lobby:join", { code: "ABC123", name: id })));
  assert.equal(results.filter((result) => result.data.role === "guest").length, 1);
  const result = await store.execute("ABC123", { id: "attacker", data: {} }, "lobby:resume", { code: "ABC123", token: "wrong" });
  assert.equal(result.data.role, undefined);
  assert.ok(result.effects.some((effect) => effect.event === "lobby:resumeError"));
});
