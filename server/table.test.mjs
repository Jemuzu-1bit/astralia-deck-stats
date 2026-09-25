import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import net from "node:net";
import { test } from "node:test";

const requireFromClient = createRequire(new URL("../client/package.json", import.meta.url));
const { io } = requireFromClient("socket.io-client");

async function freePort() {
  const probe = net.createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

function waitForState(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("lobby:state", onState);
      reject(new Error("Timed out waiting for lobby state"));
    }, 5000);
    const onState = (state) => {
      if (!predicate(state)) return;
      clearTimeout(timeout);
      socket.off("lobby:state", onState);
      resolve(state);
    };
    socket.on("lobby:state", onState);
  });
}

test("slot stacks, counters, and swaps remain synchronized and cannot modify the opponent's cards", async () => {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["server.js"], {
    cwd: new URL(".", import.meta.url),
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
  });
  const sockets = [];
  try {
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try { ready = (await fetch(`${url}/api/health`)).ok; } catch { /* server is starting */ }
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, "server should start");

    const host = io(url, { transports: ["websocket"] });
    const guest = io(url, { transports: ["websocket"] });
    sockets.push(host, guest);
    await Promise.all([once(host, "connect"), once(guest, "connect")]);

    const joined = once(host, "lobby:joined");
    host.emit("lobby:host", "Host");
    const [{ code }] = await joined;
    const guestJoined = once(guest, "lobby:joined");
    guest.emit("lobby:join", { code, name: "Guest" });
    await guestJoined;

    const readyState = waitForState(host, (state) => Boolean(state.host?.deckId && state.guest?.deckId));
    host.emit("lobby:setDeck", {
      deckId: "host-deck", deckName: "Host deck", protagonistId: "hero",
      personaCards: ["persona-a", "persona-b"], mainDeckCards: [{ id: "card-a", qty: 8 }],
    });
    guest.emit("lobby:setDeck", {
      deckId: "guest-deck", deckName: "Guest deck", protagonistId: "hero",
      personaCards: [], mainDeckCards: [{ id: "card-b", qty: 8 }],
    });
    await readyState;

    const started = waitForState(host, (state) => state.started);
    const opponentStarted = waitForState(guest, (state) => state.started);
    host.emit("lobby:startRequest");
    let state = await started;
    const opponentState = await opponentStarted;
    assert.equal(state.host.table.hand.length, 5);
    assert.equal(state.host.table.deck.length, 3);
    assert.equal(state.host.table.persona.length, 2);
    assert.equal(state.host.table.battle.length, 5);
    assert.ok(state.host.table.battle.every((stack) => stack.length === 0));
    assert.equal(state.host.table.protagonist.length, 1);
    assert.equal(state.host.table.protagonist[0].id, "hero");
    assert.equal(state.host.table.protagonist[0].isProtagonist, true);
    assert.equal(opponentState.host.table.hand.length, 0);
    assert.equal(opponentState.host.table.deck.length, 0);
    assert.equal(opponentState.host.handCount, 5);
    assert.equal(opponentState.host.deckCount, 3);
    assert.equal(opponentState.host.mainDeckCards, null);
    const uid = state.host.table.hand[0].uid;
    const protagonistUid = state.host.table.protagonist[0].uid;

    const protagonistFrazzleOne = waitForState(guest, (next) => next.host?.table?.protagonist?.[0]?.frazzle === 1);
    host.emit("game:setFrazzle", { target: "card", uid: protagonistUid, value: 1 });
    await protagonistFrazzleOne;
    const protagonistFrazzleTwo = waitForState(host, (next) => next.host?.table?.protagonist?.[0]?.frazzle === 2);
    host.emit("game:setFrazzle", { target: "card", uid: protagonistUid, delta: 1 });
    await protagonistFrazzleTwo;

    const revealed = waitForState(guest, (next) => next.host?.table?.hand?.[0]?.uid === uid);
    host.emit("game:revealCard", { uid, revealed: true });
    const revealedState = await revealed;
    assert.equal(revealedState.host.table.hand.length, 1);
    assert.equal(revealedState.host.handCount, 5);
    const hidden = waitForState(guest, (next) => next.host?.table?.hand?.length === 0);
    host.emit("game:revealCard", { uid, revealed: false });
    await hidden;

    const inGraveyard = waitForState(guest, (next) => next.host?.table?.graveyard?.[0]?.uid === uid);
    host.emit("game:moveCard", { uid, to: "graveyard" });
    state = await inGraveyard;
    assert.equal(state.host.handCount, 4);

    host.emit("game:setFrazzle", { target: "card", uid, value: 2 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(state.host.table.graveyard[0].frazzle, 0);

    const inBattle = waitForState(host, (next) => next.host?.table?.battle?.[0]?.[0]?.uid === uid);
    host.emit("game:moveCard", { uid, to: "battle", slot: 0 });
    state = await inBattle;
    assert.equal(state.host.table.battle[0][0].frazzle, 0);
    assert.equal(state.host.table.graveyard.length, 0);

    const frazzleOne = waitForState(guest, (next) => next.host?.table?.battle?.[0]?.[0]?.frazzle === 1);
    host.emit("game:setFrazzle", { target: "card", uid, value: 1 });
    await frazzleOne;
    const frazzleTwo = waitForState(host, (next) => next.host?.table?.battle?.[0]?.[0]?.frazzle === 2);
    host.emit("game:setFrazzle", { target: "card", uid, delta: 1 });
    state = await frazzleTwo;
    const frazzleMax = waitForState(host, (next) => next.host?.table?.battle?.[0]?.[0]?.frazzle === 2);
    host.emit("game:setFrazzle", { target: "card", uid, delta: 1 });
    await frazzleMax;
    const frazzleBackToOne = waitForState(host, (next) => next.host?.table?.battle?.[0]?.[0]?.frazzle === 1);
    host.emit("game:setFrazzle", { target: "card", uid, delta: -1 });
    await frazzleBackToOne;
    const frazzleRemoved = waitForState(host, (next) => next.host?.table?.battle?.[0]?.[0]?.frazzle === 0);
    host.emit("game:setFrazzle", { target: "card", uid, delta: -1 });
    await frazzleRemoved;
    const frazzleRestored = waitForState(host, (next) => next.host?.table?.battle?.[0]?.[0]?.frazzle === 2);
    host.emit("game:setFrazzle", { target: "card", uid, value: 2 });
    state = await frazzleRestored;

    const statsSet = waitForState(guest, (next) => next.host?.table?.battle?.[0]?.[0]?.atk === 7
      && next.host?.table?.battle?.[0]?.[0]?.hp === 12);
    host.emit("game:setStat", { uid, stat: "atk", value: 7 });
    host.emit("game:setStat", { uid, stat: "hp", value: 12 });
    await statsSet;
    const attackRaised = waitForState(host, (next) => next.host?.table?.battle?.[0]?.[0]?.atk === 8);
    host.emit("game:setStat", { uid, stat: "atk", delta: 1 });
    await attackRaised;
    const healthLowered = waitForState(host, (next) => next.host?.table?.battle?.[0]?.[0]?.hp === 11);
    host.emit("game:setStat", { uid, stat: "hp", delta: -1 });
    state = await healthLowered;

    const inProtagonistSubslot = waitForState(host, (next) => next.host?.table?.protagonist?.[1]?.uid === uid);
    host.emit("game:moveCard", { uid, to: "protagonist" });
    state = await inProtagonistSubslot;
    assert.equal(state.host.table.protagonist[0].uid, protagonistUid);
    assert.equal(state.host.table.protagonist[1].frazzle, 2);

    const subslotFrazzle = waitForState(host, (next) => next.host?.table?.protagonist?.[1]?.frazzle === 1);
    host.emit("game:setFrazzle", { target: "card", uid, delta: -1 });
    state = await subslotFrazzle;

    let stateAfterInvalidMove = state;
    const trackInvalidMove = (next) => { stateAfterInvalidMove = next; };
    host.on("lobby:state", trackInvalidMove);
    host.emit("game:moveCard", { uid, to: "deck", position: "top" });
    await new Promise((resolve) => setTimeout(resolve, 100));
    host.off("lobby:state", trackInvalidMove);
    assert.equal(stateAfterInvalidMove.host.table.protagonist[1].uid, uid);

    const promoted = waitForState(host, (next) => next.host?.table?.protagonist?.[0]?.uid === uid);
    host.emit("game:swapSlotCard", { uid });
    state = await promoted;
    assert.equal(state.host.table.protagonist[1].uid, protagonistUid);

    const backInBattle = waitForState(host, (next) => next.host?.table?.battle?.[0]?.[0]?.uid === uid);
    host.emit("game:moveCard", { uid, to: "battle", slot: 0 });
    state = await backInBattle;
    assert.equal(state.host.table.protagonist[0].uid, protagonistUid);

    host.emit("game:moveCard", { uid, to: "battle", slot: 5 });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(state.host.table.battle.length, 5);
    assert.equal(state.host.table.battle[0][0].uid, uid);

    const topOfDeck = waitForState(host, (next) => next.host?.table?.deck?.[0]?.uid === uid);
    host.emit("game:moveCard", { uid, to: "deck", position: "top" });
    state = await topOfDeck;
    assert.equal(state.host.table.battle[0].length, 0);
    assert.equal(state.host.table.deck[0].frazzle, 0);
    assert.equal(state.host.table.deck[0].atk, undefined);
    assert.equal(state.host.table.deck[0].hp, undefined);

    const secondUid = state.host.table.hand[0].uid;
    const bottomOfDeck = waitForState(host, (next) => next.host?.table?.deck?.at(-1)?.uid === secondUid);
    host.emit("game:moveCard", { uid: secondUid, to: "deck", position: "bottom" });
    state = await bottomOfDeck;
    assert.equal(state.host.table.deck[0].uid, uid);

    const thirdUid = state.host.table.hand[0].uid;
    const inPersona = waitForState(host, (next) => next.host?.table?.persona?.some((card) => card.uid === thirdUid));
    host.emit("game:moveCard", { uid: thirdUid, to: "persona" });
    state = await inPersona;
    const inOblivion = waitForState(host, (next) => next.host?.table?.oblivion?.[0]?.uid === thirdUid);
    host.emit("game:moveCard", { uid: thirdUid, to: "oblivion" });
    state = await inOblivion;
    assert.equal(state.host.table.persona.length, 2);

    const inSecondBattleSlot = waitForState(host, (next) => next.host?.table?.battle?.[1]?.[0]?.uid === thirdUid);
    host.emit("game:moveCard", { uid: thirdUid, to: "battle", slot: 1 });
    state = await inSecondBattleSlot;
    const fourthUid = state.host.table.hand[0].uid;
    const stacked = waitForState(host, (next) => next.host?.table?.battle?.[1]?.[1]?.uid === fourthUid);
    host.emit("game:attachCard", { uid: fourthUid, targetUid: thirdUid });
    state = await stacked;
    assert.equal(state.host.table.battle[1][0].uid, thirdUid);
    assert.equal(state.host.table.battle[1].length, 2);

    const swapped = waitForState(host, (next) => next.host?.table?.battle?.[1]?.[0]?.uid === fourthUid);
    host.emit("game:swapSlotCard", { uid: fourthUid });
    state = await swapped;
    assert.equal(state.host.table.battle[1][1].uid, thirdUid);

    let latest = state;
    const onState = (next) => { latest = next; };
    host.on("lobby:state", onState);
    guest.emit("game:moveCard", { uid: fourthUid, to: "graveyard" });
    await new Promise((resolve) => setTimeout(resolve, 100));
    host.off("lobby:state", onState);
    assert.equal(latest.host.table.battle[1][0].uid, fourthUid);
    assert.equal(latest.host.table.battle[1][1].uid, thirdUid);
    assert.equal(latest.host.table.graveyard.length, 0);

    const beforeShuffle = state.host.table.deck.map((card) => card.uid).sort();
    const shuffled = waitForState(host, (next) => next.host?.table?.deck?.length === beforeShuffle.length);
    host.emit("game:deckAction", { action: "shuffle" });
    state = await shuffled;
    assert.deepEqual(state.host.table.deck.map((card) => card.uid).sort(), beforeShuffle);

    const peekUid = state.host.table.deck[0].uid;
    const peekInHand = waitForState(host, (next) => next.host?.table?.hand?.some((card) => card.uid === peekUid));
    host.emit("game:moveCard", { uid: peekUid, to: "hand" });
    state = await peekInHand;
    assert.equal(state.host.table.deck.length, beforeShuffle.length - 1);
    const peekBackOnTop = waitForState(host, (next) => next.host?.table?.deck?.[0]?.uid === peekUid);
    host.emit("game:moveCard", { uid: peekUid, to: "deck", position: "top" });
    state = await peekBackOnTop;
    assert.equal(state.host.table.deck[0].frazzle, 0);

    const topTwo = state.host.table.deck.slice(0, 2).map((card) => card.uid);
    const drawn = waitForState(host, (next) => next.host?.table?.hand?.at(-2)?.uid === topTwo[0]);
    const opponentDrawn = waitForState(guest, (next) => next.host?.deckCount === beforeShuffle.length - 2);
    host.emit("game:deckAction", { action: "draw", count: 2 });
    state = await drawn;
    const opponentAfterDraw = await opponentDrawn;
    assert.equal(state.host.table.hand.at(-1).uid, topTwo[1]);
    assert.equal(opponentAfterDraw.host.table.hand.length, 0);
    assert.equal(opponentAfterDraw.host.handCount, state.host.table.hand.length);

    const nextTop = state.host.table.deck[0].uid;
    const discarded = waitForState(host, (next) => next.host?.table?.graveyard?.at(-1)?.uid === nextTop);
    host.emit("game:deckAction", { action: "discard", count: 1 });
    state = await discarded;
    const oblivionTop = state.host.table.deck[0].uid;
    const sentToOblivion = waitForState(host, (next) => next.host?.table?.oblivion?.at(-1)?.uid === oblivionTop);
    host.emit("game:deckAction", { action: "oblivion", count: 1 });
    state = await sentToOblivion;
    assert.equal(state.host.table.deck.length, beforeShuffle.length - 4);
    const lastCardUid = state.host.table.deck[0].uid;
    const singleDraw = waitForState(host, (next) => next.host?.table?.hand?.at(-1)?.uid === lastCardUid);
    host.emit("game:deckAction", { action: "draw", count: 1 });
    state = await singleDraw;
    assert.equal(state.host.table.deck.length, 0);
  } finally {
    sockets.forEach((socket) => socket.disconnect());
    server.kill();
    await once(server, "exit");
  }
});

test("a disconnected player can resume the same game without changing the table or deck order", async () => {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["server.js"], {
    cwd: new URL(".", import.meta.url),
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
  });
  const sockets = [];
  try {
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try { ready = (await fetch(`${url}/api/health`)).ok; } catch { /* server is starting */ }
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, "server should start");

    const host = io(url, { transports: ["websocket"] });
    const guest = io(url, { transports: ["websocket"] });
    sockets.push(host, guest);
    await Promise.all([once(host, "connect"), once(guest, "connect")]);

    const hostJoined = once(host, "lobby:joined");
    host.emit("lobby:host", "Host");
    const [{ code, token: hostToken }] = await hostJoined;
    const guestJoined = once(guest, "lobby:joined");
    guest.emit("lobby:join", { code, name: "Guest" });
    await guestJoined;

    const readyState = waitForState(host, (state) => Boolean(state.host?.deckId && state.guest?.deckId));
    host.emit("lobby:setDeck", {
      deckId: "host-deck", deckName: "Host deck", protagonistId: "host-hero",
      personaCards: ["persona-a", "persona-b"],
      mainDeckCards: [{ id: "card-a", qty: 6 }, { id: "card-b", qty: 6 }],
    });
    guest.emit("lobby:setDeck", {
      deckId: "guest-deck", deckName: "Guest deck", protagonistId: "guest-hero",
      personaCards: ["persona-c"], mainDeckCards: [{ id: "card-c", qty: 12 }],
    });
    await readyState;

    const started = waitForState(host, (state) => state.started);
    host.emit("lobby:startRequest");
    let state = await started;
    const movedUid = state.host.table.hand[0].uid;
    const moved = waitForState(host, (next) => next.host?.table?.battle?.[2]?.[0]?.uid === movedUid);
    host.emit("game:moveCard", { uid: movedUid, to: "battle", slot: 2 });
    await moved;
    const marked = waitForState(host, (next) => next.host?.table?.battle?.[2]?.[0]?.frazzle === 2);
    host.emit("game:setFrazzle", { target: "card", uid: movedUid, value: 2 });
    state = await marked;

    const tableBeforeDisconnect = structuredClone(state.host.table);
    const deckOrderBeforeDisconnect = state.host.table.deck.map((card) => card.uid);
    const offline = waitForState(guest, (next) => next.host?.connected === false);
    host.disconnect();
    await offline;

    const resumedHost = io(url, { transports: ["websocket"] });
    sockets.push(resumedHost);
    await once(resumedHost, "connect");
    const resumedJoined = once(resumedHost, "lobby:joined");
    const resumedState = waitForState(resumedHost, (next) => next.started && next.host?.connected === true);
    const opponentSeesReconnect = waitForState(guest, (next) => next.host?.connected === true);
    resumedHost.emit("lobby:resume", { code, token: hostToken });
    const [joinedPayload, afterResume] = await Promise.all([resumedJoined, resumedState]);
    await opponentSeesReconnect;

    assert.equal(joinedPayload[0].resumed, true);
    assert.equal(joinedPayload[0].role, "host");
    assert.notEqual(afterResume.host.socketId, state.host.socketId);
    assert.deepEqual(afterResume.host.table, tableBeforeDisconnect);
    assert.deepEqual(afterResume.host.table.deck.map((card) => card.uid), deckOrderBeforeDisconnect);
    assert.equal(afterResume.host.table.battle[2][0].uid, movedUid);
    assert.equal(afterResume.host.table.battle[2][0].frazzle, 2);
  } finally {
    sockets.forEach((socket) => socket.disconnect());
    server.kill();
    await once(server, "exit");
  }
});
