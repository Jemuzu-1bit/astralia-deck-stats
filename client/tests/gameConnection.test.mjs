import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { io } from "socket.io-client";
import { GameConnection } from "../src/services/gameConnection.ts";
import { createGameServer } from "../../server/createGameServer.js";
import { MemoryBackend } from "../../server/roomStore.js";

function waitForState(connection, predicate, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { unsubscribe(); reject(new Error("Client state timeout")); }, timeout);
    const unsubscribe = connection.onState((state) => {
      if (!predicate(state)) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(state);
    });
  });
}

test("the Vercel socket path connects without a trailing slash and creates a lobby", async (t) => {
  const app = await createGameServer({ backend: new MemoryBackend(), socketPath: "/api/game/socket.io" });
  app.server.listen(0, "127.0.0.1");
  await once(app.server, "listening");
  const url = `http://127.0.0.1:${app.server.address().port}`;
  const host = new GameConnection({ url, path: "/api/game/socket.io" });
  const upgradePaths = [];
  app.server.on("upgrade", (request) => upgradePaths.push(request.url));
  t.after(async () => { host.leave(); await app.close(); });

  const joined = waitForState(host, (state) => Boolean(state.code && state.host));
  host.connect();
  host.runWhenConnected(() => host.host("Host"));
  const state = await joined;
  assert.match(state.code, /^[A-F0-9]{6}$/);
  assert.ok(upgradePaths.some((path) => path.startsWith("/api/game/socket.io?")), "the upgrade must omit the trailing slash");
});

async function connectedHost(t, backend = new MemoryBackend()) {
  const values = new Map();
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const app = await createGameServer({ backend });
  app.server.listen(0, "127.0.0.1");
  await once(app.server, "listening");
  const host = new GameConnection({ url: `http://127.0.0.1:${app.server.address().port}` });
  t.after(async () => { host.leave(); await app.close(); delete globalThis.localStorage; });
  const joined = waitForState(host, (state) => Boolean(state.code));
  host.connect();
  host.runWhenConnected(() => host.host("Host"));
  const { code } = await joined;
  return { app, host, code, backend };
}

test("a temporary resume failure retries and releases queued commands on the same open socket", async (t) => {
  const { app, host, code } = await connectedHost(t);
  const originalSocket = host.getSocketId();
  const execute = app.store.execute.bind(app.store);
  let failed = false;
  app.store.execute = (...args) => {
    if (args[2] === "lobby:resume" && !failed) {
      failed = true;
      throw new Error("Temporary store outage");
    }
    return execute(...args);
  };
  const recovered = waitForState(host, (state) => state.host?.name === "Recovered");
  host.resume(code);
  host.setName("Recovered");
  await recovered;
  assert.ok(failed);
  assert.equal(host.getSocketId(), originalSocket);
  assert.equal(host.isConnected(), true);
  assert.equal(host.getStatus(), "ready");
});

test("a missed session confirmation is retried without a page reload", async (t) => {
  class DroppedConfirmationBackend extends MemoryBackend {
    dropJoined = false;
    subscribe(listener) {
      return super.subscribe((effects) => listener(effects.filter((effect) => !(this.dropJoined && effect.event === "lobby:joined"))));
    }
  }
  const backend = new DroppedConfirmationBackend();
  const { app, host, code } = await connectedHost(t, backend);
  const execute = app.store.execute.bind(app.store);
  let resumes = 0;
  app.store.execute = (...args) => {
    if (args[2] === "lobby:resume") backend.dropJoined = ++resumes === 1;
    return execute(...args);
  };
  const recovered = waitForState(host, (state) => state.host?.name === "Recovered");
  host.resume(code);
  host.setName("Recovered");
  await recovered;
  assert.equal(resumes, 2);
});

test("an application sync restores expired presence while the WebSocket stays connected", async (t) => {
  const { app, host, code, backend } = await connectedHost(t);
  const originalSocket = host.getSocketId();
  const raw = await backend.get(code);
  const room = JSON.parse(raw);
  room.presence[originalSocket] = Date.now() - 1;
  await backend.commit(code, raw, JSON.stringify(room), 30 * 60 * 1000, []);
  await app.store.execute(code, { id: "", data: {} }, "maintenance");
  assert.equal(JSON.parse(await backend.get(code)).host.socketId, null);
  const recovered = waitForState(host, (state) => state.host?.socketId === originalSocket && state.host.connected);
  host.syncSession();
  await recovered;
  const acted = waitForState(host, (state) => state.host?.name === "Still playing");
  host.setName("Still playing");
  await acted;
  assert.equal(host.getSocketId(), originalSocket);
});

test("a lost command acknowledgement on an open socket unblocks the queue without duplicating the command", async (t) => {
  const { app, host, code, backend } = await connectedHost(t);
  const originalSocket = host.getSocketId();
  let dropped = false;
  const serverSocket = app.io.sockets.sockets.get(originalSocket);
  const acknowledge = serverSocket.ack.bind(serverSocket);
  serverSocket.ack = (id) => {
    const ack = acknowledge(id);
    return (...args) => {
      if (!dropped) { dropped = true; return; }
      ack(...args);
    };
  };
  const recovered = waitForState(host, (state) => state.host?.name === "Second command", 20000);
  host.setName("First command");
  host.setName("Second command");
  await recovered;
  const room = JSON.parse(await backend.get(code));
  assert.ok(dropped);
  assert.equal(room.commands.length, 2);
  assert.equal(host.getSocketId(), originalSocket);
});

test("an unresponsive application check recreates the connection and resumes the same session", async (t) => {
  const { app, host } = await connectedHost(t);
  const originalSocket = host.getSocketId();
  const serverSocket = app.io.sockets.sockets.get(originalSocket);
  const acknowledge = serverSocket.ack.bind(serverSocket);
  let dropped = false;
  serverSocket.ack = (id) => {
    const ack = acknowledge(id);
    return (...args) => {
      if (!dropped) { dropped = true; return; }
      ack(...args);
    };
  };
  const resumed = waitForState(host, (state) => state.host?.socketId && state.host.socketId !== originalSocket);
  host.syncSession();
  await resumed;
  const acted = waitForState(host, (state) => state.host?.name === "Recovered");
  host.setName("Recovered");
  await acted;
  assert.ok(dropped);
  assert.equal(host.isConnected(), true);
});

test("the browser service resumes before replaying a committed action whose acknowledgement was lost", async (t) => {
  const values = new Map();
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  globalThis.window = globalThis;
  const backend = new MemoryBackend();
  const app = await createGameServer({ backend });
  app.server.listen(0, "127.0.0.1");
  await once(app.server, "listening");
  const url = `http://127.0.0.1:${app.server.address().port}`;
  const host = new GameConnection({ url });
  const guest = io(url, { transports: ["websocket"] });
  t.after(async () => { host.leave(); guest.disconnect(); await app.close(); delete globalThis.localStorage; delete globalThis.window; });
  const joined = waitForState(host, (state) => state.code && state.host);
  host.connect();
  host.runWhenConnected(() => host.host("Host"));
  const { code } = await joined;
  if (!guest.connected) await once(guest, "connect");
  const guestJoined = once(guest, "lobby:joined");
  guest.emit("lobby:join", { code, name: "Guest" });
  await guestJoined;
  const ready = waitForState(host, (state) => state.host.deckId && state.guest?.deckId);
  host.setDeck("host", "Host deck", "purple", "dcs_02_002ex", [], [{ id: "secret", qty: 30 }]);
  guest.emit("lobby:setDeck", { deckId: "guest", protagonistId: "dcs_02_001ex", personaCards: [], mainDeckCards: [{ id: "other-secret", qty: 30 }] });
  await ready;
  const started = waitForState(host, (state) => state.started);
  host.startRequest();
  await started;
  const originalSocket = host.getSocketId();
  let interrupted = false;
  backend.subscribe((effects) => {
    if (interrupted || !effects.some((effect) => effect.event === "lobby:state" && effect.ids.includes(originalSocket)
      && effect.payload.host.table.hand.length === 6)) return;
    interrupted = true;
    app.io.sockets.sockets.get(originalSocket).conn.close();
  });
  const resumed = waitForState(host, (state) => state.host.socketId && state.host.socketId !== originalSocket && state.host.connected);
  host.deckAction("draw", 1);
  await resumed;
  const nextAction = waitForState(host, (state) => state.host.table.fragments.length === 1);
  host.updateFragments("add");
  const after = await nextAction;
  assert.ok(interrupted);
  assert.equal(after.host.table.hand.length, 6, "replayed draw must be acknowledged without drawing again");
  assert.equal(after.host.table.deck.length, 24);
});
