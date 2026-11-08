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
    for (let attempt = 0; attempt < 150; attempt += 1) {
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

    const earlySpectator = io(url, { transports: ["websocket"] });
    sockets.push(earlySpectator);
    await once(earlySpectator, "connect");
    const spectatorJoined = once(earlySpectator, "lobby:joined");
    const spectatorLobby = waitForState(earlySpectator, (next) => next.viewerRole === "spectator" && next.spectatorCount === 1);
    earlySpectator.emit("lobby:watch", { code });
    assert.equal((await spectatorJoined)[0].role, "spectator");
    assert.equal((await spectatorLobby).guest.name, "Guest");

    const readyState = waitForState(host, (state) => Boolean(state.host?.deckId && state.guest?.deckId));
    host.emit("lobby:setDeck", {
      deckId: "host-deck", deckName: "Host deck", protagonistId: "dcs_02_002ex",
      personaCards: ["dcs_01_003ex", "dcs_01_004ex"], mainDeckCards: [{ id: "card-a", qty: 8 }],
    });
    guest.emit("lobby:setDeck", {
      deckId: "guest-deck", deckName: "Guest deck", protagonistId: "dcs_02_001ex",
      personaCards: [], mainDeckCards: [{ id: "card-b", qty: 8 }],
    });
    await readyState;

    const started = waitForState(host, (state) => state.started);
    const opponentStarted = waitForState(guest, (state) => state.started);
    const spectatorStarted = waitForState(earlySpectator, (state) => state.started);
    host.emit("lobby:startRequest");
    let state = await started;
    const opponentState = await opponentStarted;
    const earlySpectatorState = await spectatorStarted;
    assert.equal(state.turnRole, "host");
    assert.equal(state.turnNumber, 1);
    const turnPassed = waitForState(host, (next) => next.turnRole === "guest" && next.turnNumber === 2);
    host.emit("game:endTurn");
    await turnPassed;
    const turnReturned = waitForState(host, (next) => next.turnRole === "host" && next.turnNumber === 3);
    guest.emit("game:endTurn");
    state = await turnReturned;
    assert.equal(earlySpectatorState.host.table.hand.length, 0);
    assert.equal(earlySpectatorState.guest.table.hand.length, 0);
    assert.equal(earlySpectatorState.host.table.deck.length, 0);
    assert.equal(earlySpectatorState.guest.table.deck.length, 0);
    assert.equal(earlySpectatorState.host.mainDeckCards, null);
    assert.equal(earlySpectatorState.guest.mainDeckCards, null);

    const lateSpectator = io(url, { transports: ["websocket"] });
    sockets.push(lateSpectator);
    await once(lateSpectator, "connect");
    const lateSpectatorState = waitForState(lateSpectator, (next) => next.started && next.viewerRole === "spectator" && next.spectatorCount === 2);
    lateSpectator.emit("lobby:watch", { code });
    assert.equal((await lateSpectatorState).host.table.hand.length, 0);

    const deniedSpectatorAction = waitForState(lateSpectator, (next) => next.started && next.spectatorCount === 2);
    lateSpectator.emit("game:updateFragments", { action: "add" });
    lateSpectator.emit("lobby:watch", { code });
    assert.equal((await deniedSpectatorAction).host.table.fragments.length, 0);

    const spectatorSeesReveal = waitForState(earlySpectator, (next) => next.host?.table?.hand?.length === 1);
    host.emit("game:revealCard", { uid: state.host.table.hand[0].uid, revealed: true });
    assert.equal((await spectatorSeesReveal).host.table.hand[0].id, state.host.table.hand[0].id);
    const spectatorSeesHide = waitForState(earlySpectator, (next) => next.host?.table?.hand?.length === 0);
    host.emit("game:revealCard", { uid: state.host.table.hand[0].uid, revealed: false });
    await spectatorSeesHide;

    const spectatorLeft = waitForState(host, (next) => next.spectatorCount === 1);
    lateSpectator.emit("lobby:leave");
    await spectatorLeft;
    assert.equal(state.host.table.hand.length, 5);
    assert.equal(state.host.table.deck.length, 3);
    assert.equal(state.host.table.persona.length, 2);
    assert.equal(state.host.table.battle.length, 5);
    assert.ok(state.host.table.battle.every((stack) => stack.length === 0));
    assert.deepEqual(state.host.table.action, []);
    assert.equal(state.host.table.protagonist.length, 1);
    assert.equal(state.host.table.protagonist[0].id, "dcs_02_002ex");
    assert.equal(state.host.table.protagonist[0].isProtagonist, true);
    assert.equal(state.host.table.protagonist[0].atk, 0);
    assert.equal(state.host.table.protagonist[0].hp, 20);
    assert.deepEqual(state.host.table.fragments, []);
    assert.equal(opponentState.host.table.hand.length, 0);
    assert.equal(opponentState.host.table.deck.length, 0);
    assert.equal(opponentState.host.handCount, 5);
    assert.equal(opponentState.host.deckCount, 3);
    assert.equal(opponentState.host.mainDeckCards, null);

    const personaUid = state.host.table.persona[0].uid;
    const personaOnField = waitForState(guest, (next) => next.host?.table?.battle?.[1]?.[0]?.uid === personaUid);
    host.emit("game:moveCard", { uid: personaUid, to: "battle", slot: 1 });
    const placedPersona = (await personaOnField).host.table.battle[1][0];
    assert.equal(placedPersona.atk, undefined);
    assert.equal(placedPersona.hp, 3);
    const personaReturned = waitForState(host, (next) => next.host?.table?.persona?.[1]?.uid === personaUid);
    host.emit("game:moveCard", { uid: personaUid, to: "persona" });
    const returnedPersona = (await personaReturned).host.table.persona[1];
    assert.equal(returnedPersona.atk, undefined);
    assert.equal(returnedPersona.hp, undefined);

    const flippedProtagonist = waitForState(host, (next) => next.host?.table?.protagonist?.[0]?.flipped === true);
    host.emit("game:flipCard", { uid: state.host.table.protagonist[0].uid });
    assert.equal((await flippedProtagonist).host.table.protagonist[0].atk, 3);
    const frontProtagonist = waitForState(host, (next) => next.host?.table?.protagonist?.[0]?.flipped === false);
    host.emit("game:flipCard", { uid: state.host.table.protagonist[0].uid });
    assert.equal((await frontProtagonist).host.table.protagonist[0].atk, 0);

    const drawRequestReceived = waitForState(guest, (next) => next.deckRequest?.action === "draw" && next.deckRequest.count === 1);
    host.emit("game:requestDeckAction", { action: "draw", count: 1 });
    const drawRequest = (await drawRequestReceived).deckRequest;
    assert.equal(drawRequest.fromRole, "host");
    const acceptedDraw = waitForState(host, (next) => next.deckRequest === null && next.guest?.deckCount === 2);
    const recipientAfterDraw = waitForState(guest, (next) => next.deckRequest === null && next.guest?.deckCount === 2);
    guest.emit("game:respondDeckAction", { id: drawRequest.id, accepted: true });
    const afterAcceptedDraw = await acceptedDraw;
    assert.equal((await recipientAfterDraw).deckRequestResult, null);
    assert.equal(afterAcceptedDraw.guest.handCount, 6);
    assert.equal(afterAcceptedDraw.deckRequestResult.accepted, true);
    assert.equal(afterAcceptedDraw.deckRequestResult.action, "draw");

    const discardRequestReceived = waitForState(guest, (next) => next.deckRequest?.action === "discard");
    host.emit("game:requestDeckAction", { action: "discard", count: 1 });
    const discardRequest = (await discardRequestReceived).deckRequest;
    const declinedDiscard = waitForState(host, (next) => next.deckRequest === null && next.guest?.deckCount === 2);
    guest.emit("game:respondDeckAction", { id: discardRequest.id, accepted: false });
    const afterDeclinedDiscard = await declinedDiscard;
    assert.equal(afterDeclinedDiscard.guest.table.graveyard.length, 0);
    assert.equal(afterDeclinedDiscard.deckRequestResult.accepted, false);

    const lookRequestReceived = waitForState(guest, (next) => next.deckRequest?.action === "look");
    host.emit("game:requestDeckAction", { action: "look", count: 2 });
    const lookRequest = (await lookRequestReceived).deckRequest;
    const cancelledLook = waitForState(guest, (next) => next.deckRequest === null);
    host.emit("game:cancelDeckAction", { id: lookRequest.id });
    await cancelledLook;

    const tenFragments = waitForState(host, (next) => next.host?.table?.fragments?.length === 10);
    const opponentSeesFragments = waitForState(guest, (next) => next.host?.table?.fragments?.length === 10);
    for (let index = 0; index < 11; index += 1) host.emit("game:updateFragments", { action: "add" });
    state = await tenFragments;
    await opponentSeesFragments;
    assert.equal(state.host.table.fragments.length, 10, "fragments are capped at ten");
    assert.ok(state.host.table.fragments.every((spent) => spent === false));

    const twoSpent = waitForState(host, (next) => next.host?.table?.fragments?.filter(Boolean).length === 2);
    host.emit("game:updateFragments", { action: "spend" });
    host.emit("game:updateFragments", { action: "spend" });
    state = await twoSpent;
    assert.deepEqual(state.host.table.fragments.slice(0, 2), [true, true]);

    const selectedRecovered = waitForState(host, (next) => next.host?.table?.fragments?.[0] === false);
    host.emit("game:updateFragments", { action: "set", index: 0, spent: false });
    state = await selectedRecovered;
    assert.equal(state.host.table.fragments[1], true);

    const allSpent = waitForState(host, (next) => next.host?.table?.fragments?.every(Boolean));
    host.emit("game:updateFragments", { action: "spendAll" });
    await allSpent;
    const allRecovered = waitForState(host, (next) => next.host?.table?.fragments?.every((spent) => !spent));
    host.emit("game:updateFragments", { action: "recoverAll" });
    await allRecovered;
    const oneRemoved = waitForState(host, (next) => next.host?.table?.fragments?.length === 9);
    host.emit("game:updateFragments", { action: "remove" });
    state = await oneRemoved;
    const uid = state.host.table.hand[0].uid;
    const protagonistUid = state.host.table.protagonist[0].uid;

    const protagonistInGraveyard = waitForState(guest, (next) => next.host?.table?.graveyard?.[0]?.uid === protagonistUid);
    host.emit("game:moveCard", { uid: protagonistUid, to: "graveyard" });
    const movedProtagonist = await protagonistInGraveyard;
    assert.equal(movedProtagonist.host.table.protagonist.length, 0);
    assert.equal(movedProtagonist.host.table.graveyard[0].isProtagonist, true);
    const protagonistInHand = waitForState(host, (next) => next.host?.table?.hand?.some((card) => card.uid === protagonistUid));
    host.emit("game:moveCard", { uid: protagonistUid, to: "hand" });
    state = await protagonistInHand;
    assert.equal(state.host.table.graveyard.length, 0);
    const protagonistReturned = waitForState(guest, (next) => next.host?.table?.protagonist?.[0]?.uid === protagonistUid);
    host.emit("game:moveCard", { uid: protagonistUid, to: "protagonist" });
    const restoredProtagonist = await protagonistReturned;
    assert.equal(restoredProtagonist.host.table.protagonist[0].isProtagonist, true);
    assert.equal(restoredProtagonist.host.handCount, 5);

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

    const faceDownForOwner = waitForState(host, (next) => next.host?.table?.battle?.[0]?.[0]?.faceDown === true);
    const faceDownForOpponent = waitForState(guest, (next) => next.host?.table?.battle?.[0]?.[0]?.faceDown === true);
    host.emit("game:setFaceDown", { uid, faceDown: true });
    state = await faceDownForOwner;
    const coveredState = await faceDownForOpponent;
    assert.equal(state.host.table.battle[0][0].id, "card-a");
    assert.equal(coveredState.host.table.battle[0][0].id, "");
    assert.equal(coveredState.host.table.battle[0][0].uid, uid);
    assert.equal(coveredState.host.graveyardCards.length, 0);

    const faceUpForOpponent = waitForState(guest, (next) => next.host?.table?.battle?.[0]?.[0]?.faceDown === false);
    host.emit("game:setFaceDown", { uid, faceDown: false });
    const uncoveredState = await faceUpForOpponent;
    assert.equal(uncoveredState.host.table.battle[0][0].id, "card-a");

    const controlGiven = waitForState(guest, (next) => next.guest?.table?.battle?.[0]?.[0]?.uid === uid);
    host.emit("game:giveCardControl", { uid });
    const guestControls = await controlGiven;
    assert.equal(guestControls.host.table.battle[0].length, 0);
    assert.equal(guestControls.guest.table.battle[0][0].ownerRole, "host");
    const controlReturned = waitForState(host, (next) => next.host?.table?.battle?.[0]?.[0]?.uid === uid);
    guest.emit("game:giveCardControl", { uid });
    state = await controlReturned;
    assert.equal(state.host.table.battle[0][0].ownerRole, undefined);
    assert.equal(state.guest.table.battle[0].length, 0);

    const controlGivenAgain = waitForState(guest, (next) => next.guest?.table?.battle?.[0]?.[0]?.uid === uid);
    host.emit("game:giveCardControl", { uid });
    await controlGivenAgain;
    const returnedToOwnerGraveyard = waitForState(host, (next) => next.host?.table?.graveyard?.[0]?.uid === uid);
    guest.emit("game:moveCard", { uid, to: "graveyard" });
    state = await returnedToOwnerGraveyard;
    assert.equal(state.host.table.graveyard[0].ownerRole, undefined);
    assert.equal(state.guest.table.graveyard.length, 0);
    const backOnOwnerField = waitForState(host, (next) => next.host?.table?.battle?.[0]?.[0]?.uid === uid);
    host.emit("game:moveCard", { uid, to: "battle", slot: 0 });
    state = await backOnOwnerField;

    const flippedForOwner = waitForState(host, (next) => next.host?.table?.battle?.[0]?.[0]?.flipped === true);
    const flippedForOpponent = waitForState(guest, (next) => next.host?.table?.battle?.[0]?.[0]?.flipped === true);
    host.emit("game:flipCard", { uid });
    state = await flippedForOwner;
    await flippedForOpponent;
    const returnedToFront = waitForState(host, (next) => next.host?.table?.battle?.[0]?.[0]?.flipped === false);
    host.emit("game:flipCard", { uid });
    state = await returnedToFront;

    guest.emit("game:flipCard", { uid });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(state.host.table.battle[0][0].flipped, false);

    const targetUid = state.guest.table.protagonist[0].uid;
    const targetSetForOwner = waitForState(host, (next) => next.host?.table?.battle?.[0]?.[0]?.targetUid === targetUid);
    const targetSetForOpponent = waitForState(guest, (next) => next.host?.table?.battle?.[0]?.[0]?.targetUid === targetUid);
    host.emit("game:setTarget", { uid, targetUid });
    state = await targetSetForOwner;
    await targetSetForOpponent;
    assert.equal(state.host.table.battle[0][0].targetKind, "target");
    assert.ok(state.host.table.battle[0][0].targetExpiresAt > Date.now());
    assert.ok(state.host.table.battle[0][0].targetExpiresAt <= Date.now() + 5100);

    guest.emit("game:setTarget", { uid, targetUid: state.host.table.protagonist[0].uid });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(state.host.table.battle[0][0].targetUid, targetUid);

    const targetCleared = waitForState(host, (next) => next.host?.table?.battle?.[0]?.[0]?.targetUid === undefined);
    host.emit("game:setTarget", { uid, targetUid: null });
    state = await targetCleared;

    const selfTargeted = waitForState(host, (next) => next.host?.table?.battle?.[0]?.[0]?.targetUid === uid);
    host.emit("game:setTarget", { uid, targetUid: uid });
    state = await selfTargeted;
    assert.equal(state.host.table.battle[0][0].targetUid, uid);
    const selfTargetCleared = waitForState(host, (next) => next.host?.table?.battle?.[0]?.[0]?.targetUid === undefined);
    host.emit("game:setTarget", { uid, targetUid: null });
    state = await selfTargetCleared;

    const assaultAdded = waitForState(host, (next) => next.host?.table?.battle?.[0]?.[0]?.counters?.some((counter) => counter.kind === "status" && counter.label === "Assault"));
    host.emit("game:adjustCounter", { uid, kind: "status", label: "Assault", delta: 1 });
    state = await assaultAdded;
    host.emit("game:adjustCounter", { uid, kind: "status", label: "Assault", delta: 1 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(state.host.table.battle[0][0].counters.find((counter) => counter.label === "Assault").value, 1);

    const assaultedProtagonist = waitForState(guest, (next) => next.host?.table?.battle?.[0]?.[0]?.frazzle === 1);
    host.emit("game:attack", { uid, targetUid });
    const assaultedState = await assaultedProtagonist;
    assert.equal(assaultedState.host.table.battle[0][0].targetUid, targetUid);
    assert.equal(assaultedState.host.table.battle[0][0].targetKind, "attack");
    assert.equal(assaultedState.guest.table.protagonist[0].frazzle, 0);

    const lastAttackExpiresAt = assaultedState.host.table.battle[0][0].targetExpiresAt;
    host.emit("game:attack", { uid, targetUid });
    const assaultRemoved = waitForState(host, (next) => !next.host?.table?.battle?.[0]?.[0]?.counters?.some((counter) => counter.label === "Assault"));
    host.emit("game:adjustCounter", { uid, kind: "status", label: "Assault", delta: -1 });
    const assaultRemovedState = await assaultRemoved;
    assert.equal(assaultRemovedState.host.table.battle[0][0].frazzle, 1);
    assert.equal(assaultRemovedState.host.table.battle[0][0].targetExpiresAt, lastAttackExpiresAt);

    const attackerRecovered = waitForState(host, (next) => next.host?.table?.battle?.[0]?.[0]?.frazzle === 0);
    host.emit("game:setFrazzle", { target: "card", uid, delta: -1 });
    const recoveredState = await attackerRecovered;
    assert.equal(recoveredState.host.table.battle[0][0].targetExpiresAt, lastAttackExpiresAt);

    const guestBattleUid = assaultedState.guest.table.hand[0].uid;
    const guestBattleReady = waitForState(guest, (next) => next.guest?.table?.battle?.[0]?.[0]?.uid === guestBattleUid);
    guest.emit("game:moveCard", { uid: guestBattleUid, to: "battle", slot: 0 });
    await guestBattleReady;
    const battleAttacked = waitForState(guest, (next) => next.host?.table?.battle?.[0]?.[0]?.frazzle === 2);
    host.emit("game:attack", { uid, targetUid: guestBattleUid });
    const battleAttackedState = await battleAttacked;
    assert.equal(battleAttackedState.guest.table.battle[0][0].frazzle, 0);
    const guardAdded = waitForState(guest, (next) => next.guest?.table?.battle?.[0]?.[0]?.counters?.some((counter) => counter.kind === "status" && counter.label === "Guard"));
    guest.emit("game:adjustCounter", { uid: guestBattleUid, kind: "status", label: "Guard", delta: 1 });
    await guardAdded;
    const guardedBlock = waitForState(guest, (next) => next.guest?.table?.battle?.[0]?.[0]?.targetKind === "block");
    guest.emit("game:block", { uid: guestBattleUid, targetUid: uid });
    const guardedBlockState = await guardedBlock;
    assert.equal(guardedBlockState.guest.table.battle[0][0].frazzle, 0);
    assert.equal(guardedBlockState.host.table.battle[0][0].frazzle, 2);

    const guardRemoved = waitForState(guest, (next) => !next.guest?.table?.battle?.[0]?.[0]?.counters?.some((counter) => counter.label === "Guard"));
    guest.emit("game:adjustCounter", { uid: guestBattleUid, kind: "status", label: "Guard", delta: -1 });
    await guardRemoved;
    const plainBlock = waitForState(guest, (next) => next.guest?.table?.battle?.[0]?.[0]?.frazzle === 1);
    guest.emit("game:block", { uid: guestBattleUid, targetUid: uid });
    const plainBlockState = await plainBlock;
    assert.equal(plainBlockState.guest.table.battle[0][0].targetKind, "block");
    assert.equal(plainBlockState.host.table.battle[0][0].frazzle, 2);
    const lastBlockExpiresAt = plainBlockState.guest.table.battle[0][0].targetExpiresAt;
    guest.emit("game:block", { uid: guestBattleUid, targetUid: uid });
    const blockerRecovered = waitForState(guest, (next) => next.guest?.table?.battle?.[0]?.[0]?.frazzle === 0);
    guest.emit("game:setFrazzle", { target: "card", uid: guestBattleUid, delta: -1 });
    const recoveredBlockerState = await blockerRecovered;
    assert.equal(recoveredBlockerState.guest.table.battle[0][0].targetExpiresAt, lastBlockExpiresAt);
    const guestBattleReturned = waitForState(guest, (next) => next.guest?.table?.hand?.some((card) => card.uid === guestBattleUid));
    guest.emit("game:moveCard", { uid: guestBattleUid, to: "hand" });
    await guestBattleReturned;

    const actionUid = state.host.table.hand[0].uid;
    const actionPlayed = waitForState(guest, (next) => next.host?.table?.action?.[0]?.uid === actionUid);
    host.emit("game:playAction", { uid: actionUid });
    state = await actionPlayed;
    assert.equal(state.host.handCount, 3);
    const actionDiscarded = waitForState(host, (next) => next.host?.table?.graveyard?.[0]?.uid === actionUid);
    host.emit("game:moveCard", { uid: actionUid, to: "graveyard" });
    state = await actionDiscarded;
    assert.equal(state.host.table.action.length, 0);

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

    const questCounter = waitForState(guest, (next) => next.host?.table?.battle?.[0]?.[0]?.counters?.[0]?.value === 1);
    host.emit("game:adjustCounter", { uid, kind: "emoji", emoji: "📜", label: "Wrong label", delta: 1 });
    state = await questCounter;
    assert.deepEqual(state.host.table.battle[0][0].counters, [{ kind: "emoji", emoji: "📜", label: "Quest", value: 1 }]);
    const namedCounter = waitForState(guest, (next) => next.host?.table?.battle?.[0]?.[0]?.counters?.length === 2);
    host.emit("game:adjustCounter", { uid, kind: "name", label: "Poison", delta: 1 });
    state = await namedCounter;
    assert.deepEqual(state.host.table.battle[0][0].counters[1], { kind: "name", label: "Poison", value: 1 });
    const namedCounterRaised = waitForState(host, (next) => next.host?.table?.battle?.[0]?.[0]?.counters?.[1]?.value === 2);
    host.emit("game:adjustCounter", { uid, kind: "name", label: "poison", delta: 1 });
    state = await namedCounterRaised;
    assert.equal(state.host.table.battle[0][0].counters.length, 2);
    const keywordCounter = waitForState(guest, (next) => next.host?.table?.battle?.[0]?.[0]?.counters?.length === 3);
    host.emit("game:adjustCounter", { uid, kind: "customEmoji", emoji: "🪽", label: "Flying", delta: 1 });
    state = await keywordCounter;
    assert.deepEqual(state.host.table.battle[0][0].counters[2], { kind: "customEmoji", emoji: "🪽", label: "Flying", value: 1 });
    const secondKeyword = waitForState(guest, (next) => next.host?.table?.battle?.[0]?.[0]?.counters?.length === 4);
    host.emit("game:adjustCounter", { uid, kind: "customEmoji", emoji: "🪽", label: "Evasion", delta: 1 });
    state = await secondKeyword;
    assert.equal(state.host.table.battle[0][0].counters[3].label, "Evasion");
    guest.emit("game:adjustCounter", { uid, kind: "emoji", emoji: "📜", delta: -1 });
    host.emit("game:adjustCounter", { uid, kind: "emoji", emoji: "🧪", delta: 1 });
    host.emit("game:adjustCounter", { uid, kind: "customEmoji", emoji: "text", label: "Invalid", delta: 1 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(state.host.table.battle[0][0].counters[0].value, 1);
    const namedCounterLowered = waitForState(host, (next) => next.host?.table?.battle?.[0]?.[0]?.counters?.[1]?.value === 1);
    host.emit("game:adjustCounter", { uid, kind: "name", label: "Poison", delta: -1 });
    await namedCounterLowered;
    const namedCounterRemoved = waitForState(host, (next) => next.host?.table?.battle?.[0]?.[0]?.counters?.length === 3);
    host.emit("game:adjustCounter", { uid, kind: "name", label: "Poison", delta: -1 });
    state = await namedCounterRemoved;
    assert.equal(state.host.table.battle[0][0].counters[0].label, "Quest");

    const renownAdded = waitForState(guest, (next) => next.host?.table?.battle?.[0]?.[0]?.counters?.[3]?.label === "Renown");
    host.emit("game:adjustCounter", { uid, kind: "emoji", emoji: "🏆", delta: 1 });
    await renownAdded;
    const renownRaised = waitForState(host, (next) => next.host?.table?.battle?.[0]?.[0]?.counters?.[3]?.value === 2);
    host.emit("game:adjustCounter", { uid, kind: "emoji", emoji: "🏆", delta: 1 });
    await renownRaised;
    const renownRemoved = waitForState(guest, (next) => next.host?.table?.battle?.[0]?.[0]?.counters?.length === 3);
    host.emit("game:adjustCounter", { uid, kind: "emoji", emoji: "🏆", remove: true });
    state = await renownRemoved;
    assert.equal(state.host.table.battle[0][0].counters.some((counter) => counter.label === "Renown"), false);
    const adventAdded = waitForState(guest, (next) => next.host?.table?.battle?.[0]?.[0]?.counters?.[3]?.label === "Advent");
    host.emit("game:adjustCounter", { uid, kind: "emoji", emoji: "🌌", delta: 1 });
    state = await adventAdded;

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

    const coveredStats = waitForState(guest, (next) => next.host?.table?.battle?.[0]?.[0]?.faceDown === true);
    host.emit("game:setFaceDown", { uid, faceDown: true });
    const hiddenStats = (await coveredStats).host.table.battle[0][0];
    assert.equal(hiddenStats.id, "");
    assert.equal(hiddenStats.atk, undefined);
    assert.equal(hiddenStats.hp, undefined);
    const uncoveredStats = waitForState(guest, (next) => next.host?.table?.battle?.[0]?.[0]?.faceDown === false);
    host.emit("game:setFaceDown", { uid, faceDown: false });
    const visibleStats = (await uncoveredStats).host.table.battle[0][0];
    assert.equal(visibleStats.atk, 8);
    assert.equal(visibleStats.hp, 11);

    const attackRemoved = waitForState(guest, (next) => next.host?.table?.battle?.[0]?.[0]?.atk === undefined);
    host.emit("game:setStat", { uid, stat: "atk", remove: true });
    const withoutAttack = (await attackRemoved).host.table.battle[0][0];
    assert.equal(withoutAttack.hp, 11);
    const healthRemoved = waitForState(guest, (next) => next.host?.table?.battle?.[0]?.[0]?.hp === undefined);
    host.emit("game:setStat", { uid, stat: "hp", remove: true });
    const withoutStats = (await healthRemoved).host.table.battle[0][0];
    assert.equal(withoutStats.atk, undefined);
    assert.equal(withoutStats.frazzle, 2);

    const inProtagonistSubslot = waitForState(host, (next) => next.host?.table?.protagonist?.[1]?.uid === uid);
    host.emit("game:moveCard", { uid, to: "protagonist" });
    state = await inProtagonistSubslot;
    assert.equal(state.host.table.protagonist[0].uid, protagonistUid);
    assert.equal(state.host.table.protagonist[1].frazzle, 2);
    assert.deepEqual(state.host.table.protagonist[1].counters, [
      { kind: "emoji", emoji: "📜", label: "Quest", value: 1 },
      { kind: "customEmoji", emoji: "🪽", label: "Flying", value: 1 },
      { kind: "customEmoji", emoji: "🪽", label: "Evasion", value: 1 },
      { kind: "emoji", emoji: "🌌", label: "Advent", value: 1 },
    ]);

    const heroLeavesStack = waitForState(host, (next) => next.host?.table?.protagonist?.[0]?.uid === uid);
    host.emit("game:moveCard", { uid: protagonistUid, to: "graveyard" });
    state = await heroLeavesStack;
    assert.equal(state.host.table.protagonist.length, 1);
    const heroReturnsToMain = waitForState(host, (next) => next.host?.table?.protagonist?.[0]?.uid === protagonistUid);
    host.emit("game:moveCard", { uid: protagonistUid, to: "protagonist" });
    state = await heroReturnsToMain;
    assert.equal(state.host.table.protagonist[1].uid, uid);

    const subslotFrazzle = waitForState(host, (next) => next.host?.table?.protagonist?.[1]?.frazzle === 1);
    host.emit("game:setFrazzle", { target: "card", uid, delta: -1 });
    state = await subslotFrazzle;

    const subslotMovedToDeck = waitForState(host, (next) => next.host?.table?.deck?.[0]?.uid === uid);
    host.emit("game:moveCard", { uid, to: "deck", position: "top" });
    state = await subslotMovedToDeck;
    assert.equal(state.host.table.protagonist.length, 1);
    assert.equal(state.host.table.deck[0].frazzle, 0);
    assert.equal(state.host.table.deck[0].atk, undefined);
    assert.equal(state.host.table.deck[0].hp, undefined);
    assert.equal(state.host.table.deck[0].counters, undefined);

    const restoredToSubslot = waitForState(host, (next) => next.host?.table?.protagonist?.[1]?.uid === uid);
    host.emit("game:moveCard", { uid, to: "protagonist" });
    state = await restoredToSubslot;

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
    assert.deepEqual(latest.host.table.graveyard.map((card) => card.uid), [actionUid]);

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
    for (let attempt = 0; attempt < 150; attempt += 1) {
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
      deckId: "host-deck", deckName: "Host deck", protagonistId: "dcs_02_002ex",
      personaCards: ["dcs_01_003ex", "dcs_01_004ex"],
      mainDeckCards: [{ id: "card-a", qty: 6 }, { id: "card-b", qty: 6 }],
    });
    guest.emit("lobby:setDeck", {
      deckId: "guest-deck", deckName: "Guest deck", protagonistId: "dcs_02_002ex",
      personaCards: ["dcs_01_004ex", "dcs_01_003ex"], mainDeckCards: [{ id: "card-c", qty: 12 }],
    });
    await readyState;

    const started = waitForState(host, (state) => state.started);
    host.emit("lobby:startRequest");
    let state = await started;
    assert.equal(state.turnRole, null);
    assert.equal(state.turnNumber, 0);
    const firstVote = waitForState(host, (next) => next.startVotes?.host === "guest" && next.turnRole === null);
    host.emit("game:chooseStarter", "guest");
    await firstVote;
    const agreedStarter = waitForState(host, (next) => next.turnRole === "guest" && next.turnNumber === 1);
    guest.emit("game:chooseStarter", "guest");
    state = await agreedStarter;
    const movedUid = state.host.table.hand[0].uid;
    const moved = waitForState(host, (next) => next.host?.table?.battle?.[2]?.[0]?.uid === movedUid);
    host.emit("game:moveCard", { uid: movedUid, to: "battle", slot: 2 });
    await moved;
    const marked = waitForState(host, (next) => next.host?.table?.battle?.[2]?.[0]?.frazzle === 2);
    host.emit("game:setFrazzle", { target: "card", uid: movedUid, value: 2 });
    state = await marked;
    const fragmentAdded = waitForState(host, (next) => next.host?.table?.fragments?.length === 1);
    host.emit("game:updateFragments", { action: "add" });
    state = await fragmentAdded;

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
