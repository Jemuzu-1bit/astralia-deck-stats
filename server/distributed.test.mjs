import assert from "node:assert/strict";
import { once } from "node:events";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createGameServer } from "./createGameServer.js";
import { MemoryBackend } from "./roomStore.js";

const requireFromClient = createRequire(new URL("../client/package.json", import.meta.url));
const { io } = requireFromClient("socket.io-client");

function waitFor(socket, event, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(event, receive); reject(new Error(`Timed out: ${event}`)); }, 7000);
    function receive(value) {
      if (!predicate(value)) return;
      clearTimeout(timer);
      socket.off(event, receive);
      resolve(value);
    }
    socket.on(event, receive);
  });
}

async function exerciseCluster(t, backends) {
  const instances = [];
  const sockets = [];
  t.after(async () => {
    for (const socket of sockets) socket.disconnect();
    for (const instance of instances) await instance.close();
  });
  for (const backend of backends) {
    const instance = await createGameServer({ backend, socketPath: "/api/game/socket.io", serveStatic: false });
    instance.server.listen(0, "127.0.0.1");
    await once(instance.server, "listening");
    instance.url = `http://127.0.0.1:${instance.server.address().port}`;
    instances.push(instance);
  }
  async function connect(index) {
    const socket = io(instances[index].url, { transports: ["websocket"], path: "/api/game/socket.io", reconnection: false });
    sockets.push(socket);
    await once(socket, "connect");
    return socket;
  }
  const host = await connect(0);
  const guest = await connect(1);
  const spectator = await connect(1);
  const hostJoined = waitFor(host, "lobby:joined");
  host.emit("lobby:host", { name: "Host", visibility: "public", roomName: "Cross-server room" });
  const { code, token } = await hostJoined;
  const discovered = await new Promise((resolve) => spectator.emit("lobby:list", undefined, resolve));
  assert.equal(discovered.ok, true);
  assert.deepEqual(discovered.rooms.map((room) => ({ code: room.code, name: room.roomName, host: room.hostName })),
    [{ code, name: "Cross-server room", host: "Host" }], "public discovery works from a separate server instance");
  const guestJoined = waitFor(guest, "lobby:joined");
  guest.emit("lobby:join", { code, name: "Guest" });
  await guestJoined;
  const watcherJoined = waitFor(spectator, "lobby:joined");
  spectator.emit("lobby:watch", { code });
  await watcherJoined;
  const nextSpectator = await connect(0);
  const watchToken = randomUUID();
  assert.equal((await spectator.timeout(3000).emitWithAck("lobby:prepareHandoff", {
    to: nextSpectator.id, token: watchToken,
  })).handoff, true);
  const watchHandoff = await nextSpectator.timeout(3000).emitWithAck("lobby:handoff", {
    code, from: spectator.id, token: watchToken,
  });
  assert.equal(watchHandoff.state.viewerRole, "spectator");
  assert.equal(watchHandoff.state.spectatorCount, 1);
  spectator.disconnect();
  const ready = waitFor(host, "lobby:state", (state) => state.host.deckId && state.guest?.deckId);
  for (const [socket, role] of [[host, "host"], [guest, "guest"]]) socket.emit("lobby:setDeck", {
    deckId: role, protagonistId: role === "host" ? "dcs_02_002ex" : "dcs_02_001ex",
    personaCards: [], mainDeckCards: [{ id: `${role}-secret`, qty: 30 }],
  });
  await ready;
  const started = waitFor(host, "lobby:state", (state) => state.started);
  const publicStarted = waitFor(nextSpectator, "lobby:state", (state) => state.started);
  host.emit("lobby:startRequest");
  const hostState = await started;
  const publicState = await publicStarted;
  assert.deepEqual(publicState.host.table.hand, hostState.host.table.hand);
  assert.equal(publicState.guest.table.hand.length, 5);
  assert.ok(publicState.guest.table.hand.every((card) => card.id === "guest-secret"));
  assert.deepEqual(publicState.host.table.deck, []);
  assert.deepEqual(publicState.guest.table.deck, []);
  assert.equal(publicState.host.token, undefined);
  const drawn = waitFor(host, "lobby:state", (state) => state.host.table.hand.length === 6 && state.guest.handCount === 6);
  const command = { __commandId: "draw-once", data: { action: "draw", count: 1 } };
  host.emit("game:deckAction", command);
  guest.emit("game:deckAction", { action: "draw", count: 1 });
  const before = await drawn;

  // The next Function has a different Socket.IO server and no local game state.
  host.disconnect();
  const resumedHost = await connect(1);
  const resumed = waitFor(resumedHost, "lobby:state", (state) => state.viewerRole === "host" && state.host.connected);
  resumedHost.emit("lobby:resume", { code, token });
  const after = await resumed;
  assert.deepEqual(after.host.table, before.host.table);
  assert.equal(after.host.socketId, resumedHost.id);
  const acknowledgement = await new Promise((resolve) => resumedHost.emit("game:deckAction", command, resolve));
  assert.equal(acknowledgement.ok, true);
  const revision = waitFor(resumedHost, "lobby:state", (state) => state.host.table.fragments.length === 2);
  resumedHost.emit("game:updateFragments", { action: "add" });
  assert.equal((await revision).host.table.hand.length, 6, "an acknowledgement lost before reconnect must not duplicate a draw");

  const transferredHost = await connect(0);
  const handoffToken = randomUUID();
  const request = { code, from: resumedHost.id, token: handoffToken };
  assert.equal((await resumedHost.timeout(3000).emitWithAck("lobby:prepareHandoff", {
    to: transferredHost.id, token: handoffToken,
  })).handoff, true);
  assert.equal((await nextSpectator.timeout(3000).emitWithAck("lobby:handoff", request)).ok, false,
    "only the named socket can redeem the handoff");
  const handoff = await transferredHost.timeout(3000).emitWithAck("lobby:handoff", request);
  assert.equal(handoff.state.host.socketId, transferredHost.id);
  assert.equal(handoff.state.host.connected, true);
  assert.equal(handoff.state.host.table.hand.length, 6);
  assert.equal(handoff.state.guest.table.hand.length, 0);
  assert.equal(handoff.state.host.token, undefined);
  assert.equal((await transferredHost.timeout(3000).emitWithAck("lobby:handoff", request)).ok, true,
    "the new socket can retry the handoff after losing its confirmation");
  resumedHost.disconnect();
  assert.equal((await transferredHost.timeout(3000).emitWithAck("game:deckAction", command)).ok, true);

  const replaced = waitFor(transferredHost, "lobby:replaced");
  const newerHost = await connect(1);
  const newerJoined = waitFor(newerHost, "lobby:joined");
  newerHost.emit("lobby:resume", { code, token });
  await Promise.all([newerJoined, replaced]);
  transferredHost.emit("lobby:leave");
  const closed = waitFor(guest, "lobby:closed");
  newerHost.emit("lobby:leave");
  await closed;
  assert.equal(await backends[0].get(code), null);
  assert.equal((await fetch(`${instances[0].url}/api/game/health`)).status, 200);
}

test("two independent game servers share state, privacy, reconnects and room closure", async (t) => {
  const backend = new MemoryBackend();
  await exerciseCluster(t, [backend, backend]);
});

test("Redis atomically persists and distributes a real two-server game", { skip: !process.env.TEST_REDIS_URL }, async (t) => {
  const { RedisBackend } = await import("./redisBackend.js");
  const prefix = `astralia:test:${randomUUID()}`;
  const backends = [new RedisBackend(process.env.TEST_REDIS_URL, prefix), new RedisBackend(process.env.TEST_REDIS_URL, prefix)];
  // The test owns only this random namespace; never flush a shared Redis database.
  t.after(async () => {
    const { default: Redis } = await import("ioredis");
    const client = new Redis(process.env.TEST_REDIS_URL);
    try {
      const keys = await client.keys(`${prefix}:*`);
      if (keys.length) await client.del(...keys);
    } finally { client.disconnect(); }
  });
  await exerciseCluster(t, backends);
});
