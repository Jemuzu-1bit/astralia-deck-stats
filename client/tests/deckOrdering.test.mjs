import assert from "node:assert/strict";
import { test } from "node:test";
import { addToSelection, buildDeckPayload, moveSelectedCard } from "../src/domain/deckBuilder.ts";
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

test("dropping a new card inserts it at the chosen slot", () => {
  const original = selection("first", "second", "third");
  const card = { id: "new", name: "New card" };
  const inserted = addToSelection(original, card, 45, 4, 1);
  assert.deepEqual(Object.keys(inserted), ["first", "new", "second", "third"]);
  assert.equal(inserted.new.qty, 1);
  assert.deepEqual(Object.keys(addToSelection(original, card, 45, 4, 0)), ["new", "first", "second", "third"]);
  assert.deepEqual(Object.keys(addToSelection(original, card, 45, 4, 3)), ["first", "second", "third", "new"]);
  assert.deepEqual(Object.keys(original), ["first", "second", "third"]);
});

test("dropping another copy moves the existing group and respects deck limits", () => {
  const original = selection("first", "second", "third");
  const card = original.second.card;
  const inserted = addToSelection(original, card, 45, 4, 2);
  assert.deepEqual(Object.keys(inserted), ["first", "third", "second"]);
  assert.equal(inserted.second.qty, 3);
  assert.equal(addToSelection(original, card, 6, 4, 2), original);
  assert.equal(addToSelection(original, card, 45, 2, 2), original);
  assert.deepEqual(Object.keys(addToSelection(original, card, 45, 4)), Object.keys(original));
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
