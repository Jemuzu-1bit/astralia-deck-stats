import crypto from "crypto";
import { setPrintedStats } from "./cardStats.js";

export const makeId = () => crypto.randomBytes(8).toString("hex");

export function shuffle(cards) {
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]];
  }
  return cards;
}

export const REQUESTABLE_DECK_ACTIONS = ["shuffle", "draw", "discard", "oblivion", "look", "search"];
export function performDeckAction(player, action, count) {
  const { deck } = player.table;
  if (action === "shuffle") {
    shuffle(deck);
  } else {
    if (!["draw", "discard", "oblivion"].includes(action)) return false;
    if (!Number.isInteger(count) || count < 1 || deck.length === 0) return false;
    const cards = deck.splice(0, Math.min(count, deck.length));
    cards.forEach((card) => { card.revealed = false; });
    const destination = action === "draw" ? player.table.hand
      : action === "discard" ? player.table.graveyard : player.table.oblivion;
    destination.push(...cards);
  }
  syncCardLists(player);
  return true;
}

export const CARD_ZONES = ["hand", "deck", "persona", "graveyard", "oblivion", "action", "battle", "protagonist"];
export const LIST_ZONES = ["hand", "deck", "persona", "graveyard", "oblivion", "action"];
export const cardInstance = (id) => ({ uid: makeId(), id, frazzle: 0, flipped: false, revealed: false });
export const protagonistInstance = (id) => ({ ...cardInstance(id), isProtagonist: true });

export function syncCardLists(player) {
  const { table } = player;
  player.handCards = table.hand.map((card) => card.id);
  player.deckCards = table.deck.map((card) => card.id);
  player.personaCards = table.persona.map((card) => card.id);
  player.graveyardCards = table.graveyard.map((card) => card.id);
  player.oblivionCards = table.oblivion.map((card) => card.id);
}

export function findCard(table, uid) {
  for (const zone of LIST_ZONES) {
    const index = table[zone].findIndex((card) => card.uid === uid);
    if (index !== -1) return { zone, index, card: table[zone][index], slotted: false };
  }
  for (let slot = 0; slot < table.battle.length; slot += 1) {
    const index = table.battle[slot].findIndex((card) => card.uid === uid);
    if (index !== -1) return { zone: "battle", slot, index, card: table.battle[slot][index], slotted: true };
  }
  const protagonistIndex = table.protagonist.findIndex((card) => card.uid === uid);
  if (protagonistIndex !== -1) return { zone: "protagonist", index: protagonistIndex, card: table.protagonist[protagonistIndex], slotted: true };
  return null;
}

export function removeFoundCard(table, found) {
  if (found.zone === "battle") return table.battle[found.slot].splice(found.index, 1)[0];
  return table[found.zone].splice(found.index, 1)[0];
}

export function dealOpeningHand(player) {
  const deck = (player.mainDeckCards || []).flatMap((entry) => {
    const id = String(entry?.id || "");
    const qty = Math.max(0, Math.min(100, Number(entry?.qty) || 0));
    return id ? Array.from({ length: qty }, () => id) : [];
  });
  shuffle(deck);
  player.table = {
    hand: deck.slice(0, 5).map(cardInstance),
    deck: deck.slice(5).map(cardInstance),
    persona: (player.personaCards || []).map(cardInstance),
    graveyard: [],
    oblivion: [],
    action: [],
    battle: Array.from({ length: 5 }, () => []),
    protagonist: player.protagonistId ? [protagonistInstance(player.protagonistId)] : [],
    fragments: [],
  };
  player.table.protagonist.forEach(setPrintedStats);
  syncCardLists(player);
}
