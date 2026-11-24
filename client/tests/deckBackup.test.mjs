import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDeckBackup, serializeDeckBackup } from "../src/services/deckBackup.ts";
import { getDeck, listDecks, mergeLocalDecks, saveLocalDeck } from "../src/services/deckService.ts";

const oldDeck = {
  id: "6c5dc32b-1ae9-4ad6-996b-16f2412e2749",
  name: "Old Render deck",
  faction: "purple",
  protagonist: "aor_05_001_ex",
  persona: ["aor_05_004_ex"],
  deck: [{ id: "aor_05_037_n", qty: 2 }],
  backgroundImage: "data:image/png;base64,AA==",
  updatedAt: 1_700_000_000_000,
};

test("a Render browser backup preserves deck IDs, cards, dates, and backgrounds", () => {
  assert.deepEqual(parseDeckBackup(serializeDeckBackup([oldDeck])), [oldDeck]);
  assert.deepEqual(parseDeckBackup(JSON.stringify([oldDeck])), [oldDeck]);
});

test("backups retain private deck descriptions and reject invalid descriptions", () => {
  const deck = { ...oldDeck, description: "Private notes\nSecond line" };
  assert.deepEqual(parseDeckBackup(serializeDeckBackup([deck])), [deck]);
  assert.throws(() => parseDeckBackup(JSON.stringify([{ ...oldDeck, description: "x".repeat(5001) }])));
  assert.throws(() => parseDeckBackup(JSON.stringify([{ ...oldDeck, description: {} }])));
});

test("reimporting a backup keeps existing local edits and adds only missing decks", (t) => {
  const originalStorage = globalThis.localStorage;
  const saved = new Map();
  globalThis.localStorage = {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  };
  t.after(() => { globalThis.localStorage = originalStorage; });

  const newer = { ...oldDeck, name: "Edited on this device" };
  saved.set("astralia.decks", JSON.stringify([newer]));
  const other = { ...oldDeck, id: "52f6ee3a-bb14-4a6f-948e-4e519a5d4774", name: "Another deck" };
  assert.equal(mergeLocalDecks(parseDeckBackup(serializeDeckBackup([oldDeck, other]))), 1);
  assert.equal(mergeLocalDecks(parseDeckBackup(serializeDeckBackup([oldDeck, other]))), 0);
  assert.equal(listDecks().length, 2);
  assert.equal(listDecks().find((deck) => deck.id === oldDeck.id).name, newer.name);
});

test("invalid and duplicate backups are rejected before importing", () => {
  assert.throws(() => parseDeckBackup("not json"), /not a valid JSON/);
  assert.throws(() => parseDeckBackup(serializeDeckBackup([oldDeck, oldDeck])), /same deck ID/);
  assert.throws(() => parseDeckBackup(JSON.stringify([{ ...oldDeck, deck: [{ id: "x", qty: 50 }] }])), /unsupported format/);
});

test("JSON exports omit the sideboard without changing the source deck", () => {
  const sideboard = [{ id: "apx_01_001_b_n", qty: 3 }];
  const deck = { ...oldDeck, sideboard };
  const backup = serializeDeckBackup([deck]);
  assert.deepEqual(JSON.parse(backup).decks, [oldDeck]);
  assert.deepEqual(parseDeckBackup(backup), [oldDeck]);
  assert.deepEqual(deck.sideboard, sideboard);
});

test("JSON imports ignore sideboard fields in wrapped and legacy backups", () => {
  const backup = JSON.parse(serializeDeckBackup([oldDeck]));
  for (const sideboard of [null, {}, [{ id: oldDeck.persona[0], qty: 1 }]]) {
    const decks = [{ ...oldDeck, sideboard }];
    assert.deepEqual(parseDeckBackup(JSON.stringify({ ...backup, decks })), [oldDeck]);
    assert.deepEqual(parseDeckBackup(JSON.stringify(decks)), [oldDeck]);
  }
});

test("saving and reopening a browser deck preserves its sideboard, and transfers omit it", async (t) => {
  const original = globalThis.localStorage;
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  t.after(() => { globalThis.localStorage = original; });

  const deck = { ...oldDeck, sideboard: [{ id: "side-card", qty: 1 }] };
  const created = await saveLocalDeck(deck);
  assert.deepEqual(getDeck(created.id).sideboard, deck.sideboard);
  const edited = await saveLocalDeck({ ...created, sideboard: [{ id: "side-card", qty: 0 }] }, created);
  assert.equal(edited.id, created.id);
  assert.deepEqual(getDeck(created.id).sideboard, [{ id: "side-card", qty: 0 }]);
  assert.equal(mergeLocalDecks([deck]), 1);
  assert.deepEqual(getDeck(deck.id), oldDeck);
});
