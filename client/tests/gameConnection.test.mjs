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

async function connectedHost(t, backend = new MemoryBackend(), options = {}) {
  const values = new Map();
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const app = await createGameServer({ backend });
  app.server.listen(0, "127.0.0.1");
  await once(app.server, "listening");
  const host = new GameConnection({ url: `http://127.0.0.1:${app.server.address().port}`, ...options });
  t.after(async () => { host.leave(); await app.close(); delete globalThis.localStorage; });
  const joined = waitForState(host, (state) => Boolean(state.code));
  host.connect();
  host.runWhenConnected(() => host.host("Host"));
  const { code } = await joined;
  return { app, host, code, backend };
}

test("the multiplayer client discovers public rooms, joins a seat and watches without exposing private rooms", async (t) => {
  const { app, host: privateHost, code: privateCode } = await connectedHost(t);
  const url = `http://127.0.0.1:${app.server.address().port}`;
  const host = new GameConnection({ url });
  const guest = new GameConnection({ url });
  const viewer = new GameConnection({ url });
  t.after(() => { host.leave(); guest.leave(); viewer.leave(); });
  const joined = waitForState(host, (state) => state.visibility === "public");
  host.connect();
  host.runWhenConnected(() => host.host("Alice", { visibility: "public", roomName: "Practice table" }));
  const { code } = await joined;
  assert.equal(privateHost.getCurrentState().visibility, "private");
  assert.deepEqual((await host.listPublicRooms()).map((room) => room.code), [code]);
  assert.ok(!(await host.listPublicRooms()).some((room) => room.code === privateCode));
  // The guest represents a different browser, without the host's stored token.
  localStorage.removeItem(`astralia.gameSession.${code}`);
  const guestJoined = waitForState(guest, (state) => state.viewerRole === "guest");
  guest.connect();
  guest.runWhenConnected(() => guest.join("Bob", code));
  await guestJoined;
  const viewerJoined = waitForState(viewer, (state) => state.viewerRole === "spectator");
  viewer.watch(code);
  await viewerJoined;
  const rooms = await viewer.listPublicRooms();
  assert.equal(rooms[0].playerCount, 2);
  assert.equal(rooms[0].spectatorCount, 1);
  assert.equal(rooms[0].started, false);
  assert.equal(rooms[0].hostName, "Alice");
});

test("the room shares the verified Discord profile and excludes credentials and private profile fields", async (t) => {
  const env = { VITE_SUPABASE_URL: "https://supabase.example.test", VITE_SUPABASE_PUBLISHABLE_KEY: "test-key" };
  for (const [key, value] of Object.entries(env)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  const id = "10000000-0000-4000-8000-000000000001";
  const avatar = "https://cdn.discordapp.com/avatars/80351110224678912/avatar.png";
  const cosmetics = { id: "80351110224678912", banner: "a".repeat(32), decoration: "b".repeat(32), guildTag: "AST" };
  const requests = [];
  t.mock.method(globalThis, "fetch", async (input, options) => {
    const url = new URL(input);
    requests.push({ url, headers: options.headers });
    if (options.headers.Authorization !== "Bearer test-access-token") return new Response(null, { status: 401 });
    if (url.pathname === "/auth/v1/user") return Response.json({ id, email: "private@example.test", identities: [{ provider: "discord" }] });
    return Response.json([{
      name: "Discord name", avatar, favorite_chronicle: "blue",
      appearance: { cover: "discord", showAvatarDecoration: true, showGuildTag: true, featuredDeckId: "private-deck" },
      discord_appearance: cosmetics,
    }]);
  });
  const { app, backend } = await connectedHost(t);
  const url = `http://127.0.0.1:${app.server.address().port}`;
  const host = new GameConnection({ url });
  const guest = new GameConnection({ url });
  t.after(() => { host.leave(); guest.leave(); });

  const hosted = waitForState(host, (state) => state.viewerRole === "host");
  host.connect();
  host.runWhenConnected(() => host.host("Local alias", { visibility: "public", roomName: "Discord table", accessToken: "test-access-token" }));
  const { code, host: player } = await hosted;
  assert.equal(player.name, "Discord name");
  assert.equal(player.profile.avatar, avatar);
  assert.deepEqual(player.profile.discord, cosmetics);
  assert.equal(player.profile.appearance.featuredDeckId, undefined);
  assert.equal(requests[1].url.pathname, "/rest/v1/player_profiles");
  assert.equal(requests[1].url.searchParams.get("id"), `eq.${id}`);
  assert.equal(requests[1].headers.apikey, "test-key");
  const [room] = await host.listPublicRooms();
  assert.deepEqual(room.hostProfile, player.profile);
  assert.doesNotMatch(await backend.get(code), /test-access-token|private@example\.test|private-deck/);

  localStorage.removeItem(`astralia.gameSession.${code}`);
  const joined = waitForState(guest, (state) => state.viewerRole === "guest");
  guest.connect();
  guest.runWhenConnected(() => guest.join("Guest alias", code, "invalid-token"));
  const state = await joined;
  assert.deepEqual(state.host.profile, player.profile);
  assert.equal(state.guest.name, "Guest alias");
  assert.equal(state.guest.profile, undefined);
  assert.equal(requests.length, 3);
});

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

test("a scheduled handoff keeps the session ready and replays unacknowledged actions in order", { timeout: 8000 }, async (t) => {
  const { app, host, code, backend } = await connectedHost(t, new MemoryBackend(), { rotateAfterMs: 300 });
  const original = host.getSocketId();
  const statuses = [];
  const errors = [];
  host.onStatus((status) => statuses.push(status));
  host.onError((error) => errors.push(error));

  const serverSocket = app.io.sockets.sockets.get(original);
  const acknowledge = serverSocket.ack.bind(serverSocket);
  let dropped = false;
  serverSocket.ack = (id) => {
    const ack = acknowledge(id);
    return (...args) => {
      if (!dropped) { dropped = true; return; }
      ack(...args);
    };
  };
  const prepare = Promise.withResolvers();
  const release = Promise.withResolvers();
  const execute = app.store.execute.bind(app.store);
  app.store.execute = async (...args) => {
    if (args[2] === "lobby:prepareHandoff" && args[1].id === original) {
      prepare.resolve();
      await release.promise;
    }
    return execute(...args);
  };
  t.after(() => release.resolve());

  const firstCommand = waitForState(host, (state) => state.host?.name === "First");
  host.setName("First");
  await firstCommand;
  await prepare.promise;
  assert.equal(host.getSocketId(), original);
  assert.equal(host.getStatus(), "ready");
  const secondCommand = waitForState(host, (state) => state.host?.name === "Second");
  host.setName("Second");
  release.resolve();
  const after = await secondCommand;

  assert.ok(dropped);
  assert.equal(after.viewerRole, "host");
  assert.notEqual(host.getSocketId(), original);
  assert.equal(after.host.socketId, host.getSocketId());
  assert.equal(JSON.parse(await backend.get(code)).commands.length, 2);
  assert.deepEqual(statuses, []);
  assert.deepEqual(errors, []);
});

test("a lost handoff confirmation is retried on the new socket without showing recovery", async (t) => {
  const { app, host, code, backend } = await connectedHost(t);
  const original = host.getSocketId();
  const statuses = [];
  host.onStatus((status) => statuses.push(status));
  app.io.once("connection", (socket) => {
    const acknowledge = socket.ack.bind(socket);
    socket.ack = (id) => {
      socket.ack = acknowledge;
      return () => {};
    };
  });
  await host.rotateSocket();
  assert.notEqual(host.getSocketId(), original);
  assert.equal(host.getSocketId(), JSON.parse(await backend.get(code)).host.socketId);
  assert.deepEqual(statuses, []);
});

test("a failed preparation leaves the original connection usable", async (t) => {
  const { app, host } = await connectedHost(t);
  const original = host.getSocketId();
  const execute = app.store.execute.bind(app.store);
  app.store.execute = (...args) => {
    if (args[2] === "lobby:prepareHandoff") throw new Error("Simulated transient Redis failure");
    return execute(...args);
  };
  const statuses = [];
  const errors = [];
  host.onStatus((status) => statuses.push(status));
  host.onError((error) => errors.push(error));
  await host.rotateSocket();
  const acted = waitForState(host, (state) => state.host?.name === "Still here");
  host.setName("Still here");
  await acted;
  assert.equal(host.getSocketId(), original);
  assert.deepEqual(statuses, []);
  assert.deepEqual(errors, []);
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
  const nextAction = waitForState(host, (state) => state.host.table.fragments.length === 2);
  host.updateFragments("add");
  const after = await nextAction;
  assert.ok(interrupted);
  assert.equal(after.host.table.hand.length, 6, "replayed draw must be acknowledged without drawing again");
  assert.equal(after.host.table.deck.length, 24);
});
