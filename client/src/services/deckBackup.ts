import type { Deck } from "../types/Deck";

const BACKUP_FORMAT = "astralia-decks-backup";
const BACKUP_VERSION = 1;
const MAX_DECKS = 500;
const MAX_BACKGROUND_LENGTH = 7_000_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isCardId(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 100;
}

function parseDeck(value: unknown, index: number): Deck {
  if (!value || typeof value !== "object") throw new Error(`Deck ${index + 1} is invalid.`);
  const deck = value as Partial<Deck>;
  if (typeof deck.id !== "string" || !UUID.test(deck.id)
    || typeof deck.name !== "string" || deck.name.length < 1 || deck.name.length > 100
    || typeof deck.faction !== "string" || deck.faction.length < 1 || deck.faction.length > 32
    || !(deck.protagonist == null || isCardId(deck.protagonist))
    || !Array.isArray(deck.persona) || deck.persona.length > 5 || !deck.persona.every(isCardId)
    || !Array.isArray(deck.deck) || deck.deck.length > 45
    || !deck.deck.every((card) => card && isCardId(card.id) && Number.isInteger(card.qty) && card.qty >= 1 && card.qty <= 4)
    || deck.deck.reduce((total, card) => total + card.qty, 0) > 45
    || typeof deck.updatedAt !== "number" || !Number.isFinite(deck.updatedAt) || deck.updatedAt <= 0
    || !(deck.backgroundImage == null || (typeof deck.backgroundImage === "string"
      && deck.backgroundImage.length <= MAX_BACKGROUND_LENGTH
      && /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(deck.backgroundImage)))) {
    throw new Error(`Deck ${index + 1} has an unsupported format.`);
  }
  return {
    id: deck.id,
    name: deck.name,
    faction: deck.faction,
    protagonist: deck.protagonist ?? null,
    persona: [...deck.persona],
    deck: deck.deck.map(({ id, qty }) => ({ id, qty })),
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

export function parseDeckBackup(json: string): Deck[] {
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
  const decks = data.map(parseDeck);
  const ids = new Set<string>();
  for (const deck of decks) {
    if (ids.has(deck.id)) throw new Error("The backup contains the same deck ID more than once.");
    ids.add(deck.id);
  }
  return decks;
}
