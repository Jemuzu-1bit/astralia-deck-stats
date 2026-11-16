import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { io } from "socket.io-client";
import { GameConnection } from "../src/services/gameConnection.ts";
import { createGameServer } from "../../server/createGameServer.js";
import { MemoryBackend } from "../../server/roomStore.js";

function waitForState(connection, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { unsubscribe(); reject(new Error("Client state timeout")); }, 12000);
    const unsubscribe = connection.onState((state) => {
      if (!predicate(state)) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(state);
    });
  });
}

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
