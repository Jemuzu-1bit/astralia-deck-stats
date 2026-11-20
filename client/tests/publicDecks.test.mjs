import assert from "node:assert/strict";
import { test } from "node:test";
import { privateDeckCopy, safeProfileUrl } from "../src/domain/publicDecks.ts";
import { createDeck, getDeck } from "../src/services/deckService.ts";

const source = {
  id: "author-deck", ownerId: "author", revision: 9, visibility: "public", publishedAt: 123,
  updatedAt: 456, name: "Published strategy", faction: "blue", protagonist: "hero",
  persona: ["persona"], deck: [{ id: "card", qty: 3 }], backgroundImage: "https://example.com/signed-private-image",
  author: { name: "Author", id: "author" },
};

test("import is an independent private copy without author or cloud storage metadata", () => {
  const copied = privateDeckCopy(source);
  assert.deepEqual(copied, {
    name: source.name, faction: source.faction, protagonist: source.protagonist,
    persona: ["persona"], deck: [{ id: "card", qty: 3 }], backgroundImage: null,
    visibility: "private", publishedAt: null,
  });
  copied.persona.push("another");
  copied.deck[0].qty = 1;
  assert.deepEqual(source.persona, ["persona"]);
  assert.equal(source.deck[0].qty, 3);
});

test("guest imports are persisted with a new ID and leave the source untouched", t => {
  const original = globalThis.localStorage;
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  t.after(() => { globalThis.localStorage = original; });
  const saved = createDeck(privateDeckCopy(source));
  assert.notEqual(saved.id, source.id);
  assert.equal(saved.visibility, "private");
  assert.equal(saved.revision, undefined);
  assert.deepEqual(getDeck(saved.id), saved);
  assert.equal(source.visibility, "public");
});

test("untrusted public profile URLs reject executable schemes and credentials", () => {
  for (const value of ["javascript:alert(1)", "data:text/html,unsafe", "//example.com", "https://name:password@example.com", "invalid"]) {
    assert.equal(safeProfileUrl(value), "");
  }
  assert.equal(safeProfileUrl("https://example.com/player"), "https://example.com/player");
});

test("imported public decks preserve their description and sideboard without copying discussion metadata", () => {
  const sideboard = [{ id: "card", qty: 1 }];
  const copied = privateDeckCopy({ ...source, sideboard, description: "A strategy\nwith two lines", comments: [{ body: "Feedback" }] });
  assert.equal(copied.description, "A strategy\nwith two lines");
  assert.deepEqual(copied.sideboard, sideboard);
  copied.sideboard[0].qty = 2;
  assert.equal(sideboard[0].qty, 1);
  assert.equal(copied.comments, undefined);
});
