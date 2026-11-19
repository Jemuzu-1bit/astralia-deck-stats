import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDeckPayload, moveSelectedCard } from "../src/domain/deckBuilder.ts";
import { createDeck, getDeck, updateDeck } from "../src/services/deckService.ts";

const selection = (...ids) => Object.fromEntries(ids.map((id, index) => [id, {
  card: { id, name: id, cost: "1", type: "Character" },
  qty: index + 1,
}]));

test("moving cards in either direction inserts them and preserves every quantity", () => {
  const original = selection("first", "second", "third", "fourth");
  const moved = moveSelectedCard(original, "first", "third");
  assert.deepEqual(Object.keys(moved), ["second", "third", "first", "fourth"]);
  assert.deepEqual(Object.keys(original), ["first", "second", "third", "fourth"]);
  for (const id of Object.keys(original)) assert.equal(moved[id], original[id]);
  assert.deepEqual(Object.keys(moveSelectedCard(moved, "first", "second")), Object.keys(original));
});

test("invalid targets and cards from another section leave the selection unchanged", () => {
  const original = selection("first", "second", "third");
  assert.equal(moveSelectedCard(original, "first", "persona-card"), original);
  assert.equal(moveSelectedCard(original, "persona-card", "first"), original);
  assert.equal(moveSelectedCard(original, "second", "second"), original);
});

test("the overview and sidebar order survives saving, editing and reopening a deck", t => {
  const previousStorage = globalThis.localStorage;
  const saved = new Map();
  globalThis.localStorage = {
    getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  };
  t.after(() => { globalThis.localStorage = previousStorage; });
  const deckCards = moveSelectedCard(selection("first", "second", "third"), "third", "first");
  const personas = moveSelectedCard(selection("persona-a", "persona-b"), "persona-b", "persona-a");
  const payload = buildDeckPayload({
    name: "Ordered deck",
    faction: "purple",
    protagonist: null,
    persona: personas,
    deck: deckCards,
    backgroundImage: null,
  });
  const deck = createDeck(payload);
  assert.deepEqual(getDeck(deck.id).deck.map(entry => entry.id), ["third", "first", "second"]);
  assert.deepEqual(getDeck(deck.id).deck.map(entry => entry.qty), [3, 1, 2]);
  assert.deepEqual(getDeck(deck.id).persona, ["persona-b", "persona-a"]);
  updateDeck({ ...deck, deck: [...deck.deck].reverse() });
  assert.deepEqual(getDeck(deck.id).deck.map(entry => entry.id), ["second", "first", "third"]);
  assert.deepEqual(getDeck(deck.id).persona, ["persona-b", "persona-a"]);
});
