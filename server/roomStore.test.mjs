import assert from "node:assert/strict";
import { test } from "node:test";
import { MemoryBackend, RoomStore, decodeRoom, encodeRoom } from "./roomStore.js";
import { ROOM_TTL_MS, PRESENCE_TTL_MS } from "./roomLifecycle.js";
import { publicState } from "./roomState.js";
import { MAX_ACTIVITY_ENTRIES } from "./activityLog.js";

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
  assert.equal(room.activityLog.length, 21, "each committed action is logged once despite concurrent retries");
  assert.equal(new Set(room.activityLog.map((entry) => entry.id)).size, 21);
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
    if (state.viewerRole === "spectator") {
      assert.equal(state.host.table.hand.length, state.host.handCount);
      assert.equal(state.guest.table.hand.length, state.guest.handCount);
      assert.deepEqual(state.host.table.deck, []);
      assert.deepEqual(state.guest.table.deck, []);
    } else {
      if (state.viewerRole !== "host") assert.equal(state.host.table.hand.length, 0);
      if (state.viewerRole !== "guest") assert.equal(state.guest.table.hand.length, 0);
    }
  }
});

test("spectators see both complete hands as cards move but cannot change the match", async () => {
  const f = await fixture();
  const before = await f.read();
  for (const event of ["game:moveCard", "game:revealCard"]) {
    await f.command("viewer", event, { uid: before.host.table.hand[0].uid, to: "graveyard", revealed: true });
  }
  await f.command("viewer", "game:deckAction", { action: "draw", count: 1 });
  const unchanged = await f.read();
  assert.deepEqual(unchanged.host.table, before.host.table);
  assert.deepEqual(unchanged.guest.table, before.guest.table);

  await f.command("host", "game:moveCard", { uid: before.host.table.hand[0].uid, to: "battle", slot: 0 });
  await f.command("host", "game:setFaceDown", { uid: before.host.table.hand[0].uid, faceDown: true });
  await f.command("guest", "game:deckAction", { action: "draw", count: 2 });
  const room = await f.read();
  const spectator = publicState(room, f.actors.viewer.id);
  for (const role of ["host", "guest"]) {
    assert.deepEqual(spectator[role].table.hand, room[role].table.hand);
    assert.deepEqual(spectator[role].table.deck, []);
    assert.deepEqual(spectator[role].deckCards, []);
    assert.equal(spectator[role].mainDeckCards, null);
    assert.equal(spectator[role].token, undefined);
  }
  assert.equal(spectator.host.table.hand.length, 4);
  assert.equal(spectator.guest.table.hand.length, 7);
  assert.equal(spectator.host.table.battle[0][0].id, "");
  assert.deepEqual(publicState(room, f.actors.host.id).guest.table.hand, []);
  assert.deepEqual(publicState(room, f.actors.guest.id).host.table.hand, []);
  const outsider = publicState(room, "unregistered-socket");
  assert.deepEqual(outsider.host.table.hand, []);
  assert.deepEqual(outsider.guest.table.hand, []);
  await f.command("viewer", "lobby:leave");
  const formerSpectator = publicState(await f.read(), f.actors.viewer.id);
  assert.deepEqual(formerSpectator.host.table.hand, []);
  assert.deepEqual(formerSpectator.guest.table.hand, []);
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
  assert.deepEqual(after.activityLog, before.activityLog, "resuming and replaying a saved command must not duplicate activity");
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

test("a live authenticated socket recovers expired presence before applying its command", async () => {
  let time = Date.now();
  const now = () => time;
  const f = await fixture(new MemoryBackend({ now }), now);
  const before = await f.read();
  time += PRESENCE_TTL_MS + 1;
  await f.store.execute(f.code, { id: "", data: {} }, "maintenance");
  assert.equal((await f.read()).host.socketId, null);
  await f.command("host", "game:deckAction", { action: "draw", count: 1 }, "after-expiry");
  const after = await f.read();
  assert.equal(after.host.socketId, f.actors.host.id);
  assert.equal(after.host.connected, true);
  assert.equal(after.host.table.hand.length, before.host.table.hand.length + 1);
  assert.deepEqual(after.guest.table, before.guest.table);
});

test("presence recovery never lets a replaced socket reclaim another tab's seat", async () => {
  const f = await fixture();
  const room = await f.read();
  const replacement = { id: "replacement", data: {} };
  await f.store.execute(f.code, replacement, "lobby:resume", { code: f.code, token: room.host.token });
  await f.command("host", "heartbeat");
  await f.command("host", "game:deckAction", { action: "draw", count: 1 });
  const after = await f.read();
  assert.equal(after.host.socketId, replacement.id);
  assert.deepEqual(after.host.table, room.host.table);
});

test("activity is shared with both players and late spectators without exposing hidden cards", async () => {
  const f = await fixture();
  let room = await f.read();
  assert.match(room.activityLog[0].text, /started the match/);
  await f.command("host", "game:deckAction", { action: "draw", count: 2 });
  room = await f.read();
  assert.match(room.activityLog.at(-1).text, /draw 2 cards/);
  const hidden = room.host.table.hand[0];
  await f.command("host", "game:flipCard", { uid: hidden.uid });
  room = await f.read();
  assert.match(room.activityLog.at(-1).text, /flipped a hidden card/);
  assert.ok(!JSON.stringify(room.activityLog).includes("host-secret"));
  assert.ok(!JSON.stringify(room.activityLog).includes(hidden.uid));
  const deckBefore = room.host.table.deck;
  await f.command("host", "game:deckAction", { action: "look", count: 3 });
  assert.match((await f.read()).activityLog.at(-1).text, /look at the top 3 cards/);
  await f.command("host", "game:deckAction", { action: "search" });
  room = await f.read();
  assert.match(room.activityLog.at(-1).text, /search the deck/);
  assert.deepEqual(room.host.table.deck, deckBefore);
  assert.ok(!JSON.stringify(room.activityLog).includes("host-secret"));
  await f.command("host", "game:moveCard", { uid: hidden.uid, to: "battle", slot: 0 });
  assert.match((await f.read()).activityLog.at(-1).text, /host-secret from hand to Battle slot 1/);
  await f.command("host", "game:setFaceDown", { uid: hidden.uid, faceDown: true });
  // Once a public card is face down, subsequent actions use an anonymous label.
  await f.command("host", "game:setStat", { uid: hidden.uid, stat: "hp", value: 73 });
  assert.equal((await f.read()).activityLog.at(-1).text, "updated HP on a face-down card");
  await f.command("host", "game:moveCard", { uid: hidden.uid, to: "oblivion" });
  room = await f.read();
  assert.match(room.activityLog.at(-1).text, /a face-down card from Battle slot 1 to Oblivion/);
  const late = { id: "late-viewer", data: {} };
  const joined = await f.store.execute(f.code, late, "lobby:watch", { code: f.code });
  const lateState = joined.effects.find((effect) => effect.event === "lobby:joined");
  assert.ok(lateState);
  room = await f.read();
  for (const id of [f.actors.host.id, f.actors.guest.id, f.actors.viewer.id, late.id]) {
    assert.deepEqual(publicState(room, id).activityLog, room.activityLog);
  }
});

test("activity records combat, counters, fragments, requests, and turns, ignoring rejected and unchanged actions", async () => {
  const f = await fixture();
  let room = await f.read();
  const uid = room.host.table.protagonist[0].uid;
  const targetUid = room.guest.table.protagonist[0].uid;
  const commands = [
    ["host", "game:attack", { uid, targetUid }, /attacked/],
    ["host", "game:setFrazzle", { uid, delta: -1 }, /Frazzle/],
    ["host", "game:block", { uid, targetUid }, /blocked/],
    ["host", "game:adjustCounter", { uid, kind: "name", label: "Power", delta: 1 }, /Power/],
    ["host", "game:updateFragments", { action: "add" }, /1 ready, 0 spent/],
    ["host", "game:requestDeckAction", { action: "look", count: 2 }, /requested.*top 2 cards/],
  ];
  for (const [role, event, payload, expected] of commands) {
    const count = (await f.read()).activityLog.length;
    await f.command(role, event, payload);
    room = await f.read();
    assert.equal(room.activityLog.length, count + 1, event);
    assert.match(room.activityLog.at(-1).text, expected);
  }
  await f.command("guest", "game:respondDeckAction", { id: room.deckRequest.id, accepted: true });
  assert.match((await f.read()).activityLog.at(-1).text, /accepted Host's request.*top 2 cards/);
  await f.command("host", "game:endTurn");
  room = await f.read();
  assert.match(room.activityLog.at(-1).text, /Guest's turn begins/);
  const count = room.activityLog.length;
  await f.command("host", "game:endTurn");
  await f.command("viewer", "game:updateFragments", { action: "add" });
  await f.command("host", "game:moveCard", { uid: "missing", to: "hand" });
  await f.command("host", "game:updateFragments", { action: "recoverAll" });
  await f.command("host", "game:deckAction", { action: "look", count: 9999 });
  await f.command("host", "game:setFrazzle", { uid, value: room.host.table.protagonist[0].frazzle });
  await f.command("host", "heartbeat");
  assert.equal((await f.read()).activityLog.length, count);
  await f.command("host", "game:deckAction", { action: "shuffle" });
  assert.match((await f.read()).activityLog.at(-1).text, /shuffle the deck/);
});

test("legacy rooms gain activity lazily and retained activity remains bounded with monotonic ids", async () => {
  const f = await fixture();
  let room = await f.read();
  delete room.activityLog;
  delete room.activitySequence;
  let raw = await f.backend.get(f.code);
  await f.backend.commit(f.code, raw, encodeRoom(room), ROOM_TTL_MS, []);
  await f.command("host", "game:updateFragments", { action: "add" });
  room = await f.read();
  assert.equal(room.activityLog.length, 1);
  const entry = room.activityLog[0];
  room.activityLog = Array.from({ length: MAX_ACTIVITY_ENTRIES }, (_, index) => ({ ...entry, id: index + 1 }));
  room.activitySequence = MAX_ACTIVITY_ENTRIES;
  raw = await f.backend.get(f.code);
  await f.backend.commit(f.code, raw, encodeRoom(room), ROOM_TTL_MS, []);
  await f.command("host", "game:updateFragments", { action: "spendAll" });
  room = await f.read();
  assert.equal(room.activityLog.length, MAX_ACTIVITY_ENTRIES);
  assert.equal(room.activityLog[0].id, 2);
  assert.equal(room.activityLog.at(-1).id, MAX_ACTIVITY_ENTRIES + 1);
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
