import { getCardIdentity } from "../data/cardDataReader.ts";
import { CARDS_PER_DECK, COPIES_PER_CARD, getCardDeckSection, PERSONA_LIMIT, type DeckSection } from "../domain/deckBuilder.ts";
import type { Card } from "../types/Card";
import type { Deck, DeckEntry } from "../types/Deck";

const BACKUP_FORMAT = "astralia-decks-backup";
const BACKUP_VERSION = 1;
const MAX_DECKS = 500;
const MAX_BACKGROUND_LENGTH = 7_000_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isCardId(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 100;
}

function isDeckEntry(card: DeckEntry): boolean {
  return card != null && isCardId(card.id) && Number.isInteger(card.qty) && card.qty >= 1 && card.qty <= COPIES_PER_CARD;
}

function respectsCopyLimit(deck: DeckEntry[], persona: string[], sideboard: DeckEntry[], cardSections: ReadonlyMap<string, DeckSection | undefined>): boolean {
  const counts = new Map<string, number>();
  const personaIdentities = new Set(persona.map(getCardIdentity));
  for (const { id, qty } of [...deck, ...sideboard]) {
    const identity = getCardIdentity(id);
    if (personaIdentities.has(identity)) return false;
    const total = (counts.get(identity) ?? 0) + qty;
    if (total > (cardSections.get(identity) === "persona" ? 1 : COPIES_PER_CARD)) return false;
    counts.set(identity, total);
  }
  return !deck.some(({ id }) => cardSections.get(getCardIdentity(id)) === "persona")
    && !sideboard.some(({ id }) => cardSections.get(getCardIdentity(id)) === "protagonist");
}

function parseDeck(value: unknown, index: number, cardSections: ReadonlyMap<string, DeckSection | undefined>): Deck {
  if (!value || typeof value !== "object") throw new Error(`Deck ${index + 1} is invalid.`);
  const deck = value as Partial<Deck>;
  if (typeof deck.id !== "string" || !UUID.test(deck.id)
    || typeof deck.name !== "string" || deck.name.length < 1 || deck.name.length > 100
    || !(deck.description === undefined || (typeof deck.description === "string" && deck.description.length <= 5000))
    || typeof deck.faction !== "string" || deck.faction.length < 1 || deck.faction.length > 32
    || !(deck.protagonist == null || isCardId(deck.protagonist))
    || !Array.isArray(deck.persona) || deck.persona.length > PERSONA_LIMIT || !deck.persona.every(isCardId)
    || !Array.isArray(deck.deck) || deck.deck.length > CARDS_PER_DECK || !deck.deck.every(isDeckEntry)
    || deck.deck.reduce((total, card) => total + card.qty, 0) > CARDS_PER_DECK
    || (deck.sideboard !== undefined && (!Array.isArray(deck.sideboard) || !deck.sideboard.every(isDeckEntry)
      || !respectsCopyLimit(deck.deck, deck.persona, deck.sideboard, cardSections)))
    || typeof deck.updatedAt !== "number" || !Number.isFinite(deck.updatedAt) || deck.updatedAt <= 0
    || !(deck.backgroundImage == null || (typeof deck.backgroundImage === "string"
      && deck.backgroundImage.length <= MAX_BACKGROUND_LENGTH
      && /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(deck.backgroundImage)))) {
    throw new Error(`Deck ${index + 1} has an unsupported format.`);
  }
  return {
    id: deck.id,
    name: deck.name,
    ...(deck.description !== undefined ? { description: deck.description } : {}),
    faction: deck.faction,
    protagonist: deck.protagonist ?? null,
    persona: [...deck.persona],
    deck: deck.deck.map(({ id, qty }) => ({ id, qty })),
    ...(deck.sideboard !== undefined ? { sideboard: deck.sideboard.map(({ id, qty }) => ({ id, qty })) } : {}),
    backgroundImage: deck.backgroundImage ?? null,
    updatedAt: deck.updatedAt,
  };
}

export function serializeDeckBackup(decks: Deck[]): string {
  return JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    decks,
  }, null, 2);
}

export function parseDeckBackup(json: string, catalog: readonly Pick<Card, "id" | "mainDeck">[] = []): Deck[] {
  let parsed: unknown;
  try { parsed = JSON.parse(json); }
  catch { throw new Error("This is not a valid JSON backup."); }
  // Accept the raw `astralia.decks` array as a fallback for older Render builds.
  const data = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object"
    && "format" in parsed && parsed.format === BACKUP_FORMAT
    && "version" in parsed && parsed.version === BACKUP_VERSION
    && "decks" in parsed ? parsed.decks : null;
  if (!Array.isArray(data) || data.length > MAX_DECKS) {
    throw new Error("Unsupported deck backup or too many decks (maximum 500).");
  }
  const cardSections = new Map(catalog.map(card => [getCardIdentity(card), getCardDeckSection(card)]));
  const decks = data.map((deck, index) => parseDeck(deck, index, cardSections));
  const ids = new Set<string>();
  for (const deck of decks) {
    if (ids.has(deck.id)) throw new Error("The backup contains the same deck ID more than once.");
    ids.add(deck.id);
  }
  return decks;
}
