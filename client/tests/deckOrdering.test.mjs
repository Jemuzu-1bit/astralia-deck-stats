import assert from "node:assert/strict";
import { test } from "node:test";
import { addDeckCard, addToSelection, buildDeckPayload, countSelectedCards, moveSelectedCard, transferDeckCard } from "../src/domain/deckBuilder.ts";
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

test("main deck and sideboard share four copies across print variants", () => {
  const firstPrint = { id: "apx_01_001_a_n", mainDeck: "Deck" };
  const secondPrint = { id: "apx_01_001_b_n", mainDeck: "Deck" };
  let cards = addDeckCard({ persona: {}, deck: {}, sideboard: {} }, "deck", firstPrint);
  for (let i = 0; i < 3; i++) cards = addDeckCard(cards, "sideboard", secondPrint);

  assert.equal(cards.deck[firstPrint.id].qty, 1);
  assert.equal(cards.sideboard[secondPrint.id].qty, 3);
  assert.equal(addDeckCard(cards, "deck", secondPrint), cards);
  assert.equal(addDeckCard(cards, "sideboard", firstPrint), cards);

  cards = transferDeckCard(cards, "sideboard", secondPrint);
  assert.equal(cards.deck[secondPrint.id].qty, 1);
  assert.equal(cards.sideboard[secondPrint.id].qty, 2);
});

test("a full main deck can send cards to the sideboard without losing a blocked transfer", () => {
  let cards = { persona: {}, deck: {}, sideboard: {} };
  for (let i = 0; i < 46; i++) {
    const card = { id: `card-${i}`, mainDeck: "Deck" };
    cards = addDeckCard(cards, "deck", card);
    cards = addDeckCard(cards, "sideboard", card);
  }
  const extraCard = { id: "card-45", mainDeck: "Deck" };
  assert.equal(countSelectedCards(cards.deck), 45);
  assert.equal(countSelectedCards(cards.sideboard), 46);
  assert.equal(transferDeckCard(cards, "sideboard", extraCard), cards);

  cards = transferDeckCard(cards, "deck", { id: "card-0", mainDeck: "Deck" });
  cards = transferDeckCard(cards, "sideboard", extraCard);
  const payload = buildDeckPayload({ name: "Full deck", faction: "red", persona: {}, protagonist: null, ...cards, backgroundImage: null });
  assert.deepEqual(payload.deck.at(-1), { id: "card-45", qty: 1 });
  assert.deepEqual(payload.sideboard[0], { id: "card-0", qty: 2 });
  assert.equal(payload.sideboard.some(({ id }) => id === extraCard.id), false);
});

test("a Persona can be placed once and moved between Persona Deck and Sideboard", () => {
  const persona = { id: "persona-0", mainDeck: "Persona" };
  const empty = { persona: {}, deck: {}, sideboard: {} };
  assert.equal(addDeckCard(empty, "deck", persona), empty);
  let cards = addDeckCard(empty, "sideboard", persona);
  assert.equal(cards.sideboard[persona.id].qty, 1);
  assert.equal(addDeckCard(cards, "sideboard", persona), cards);
  assert.equal(addDeckCard(cards, "persona", persona), cards);

  const moved = transferDeckCard(cards, "sideboard", persona);
  assert.equal(moved.persona[persona.id].qty, 1);
  assert.deepEqual(moved.sideboard, {});
  assert.equal(addDeckCard(moved, "sideboard", persona), moved);
  assert.deepEqual(transferDeckCard(moved, "persona", persona), cards);

  for (let i = 1; i <= 5; i++) cards = addDeckCard(cards, "persona", { id: `persona-${i}`, mainDeck: "Persona" });
  assert.equal(transferDeckCard(cards, "sideboard", persona), cards);
});

test("moving a copy between sections inserts it at the previewed position", () => {
  const card = { id: "moved", mainDeck: "Deck" };
  const original = {
    persona: {}, deck: { moved: { card, qty: 2 } }, sideboard: selection("first", "moved", "last"),
  };
  const moved = transferDeckCard(original, "deck", card, 0);
  assert.deepEqual(Object.keys(moved.sideboard), ["moved", "first", "last"]);
  assert.equal(moved.sideboard.moved.qty, 3);
  assert.equal(moved.deck.moved.qty, 1);
  assert.deepEqual(Object.keys(moveSelectedCard(moved.sideboard, card.id, 3)), ["first", "last", "moved"]);
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
