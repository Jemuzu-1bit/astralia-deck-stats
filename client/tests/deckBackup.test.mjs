import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDeckBackup, serializeDeckBackup } from "../src/services/deckBackup.ts";
import { listDecks, mergeLocalDecks } from "../src/services/deckService.ts";

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
