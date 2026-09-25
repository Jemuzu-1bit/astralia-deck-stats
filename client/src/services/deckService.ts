import type { Deck, DeckEntry } from "../types/Deck";
import { isAlternativeArt, readCardData } from "../data/cardDataReader";

const STORAGE_KEY = "astralia.decks";

function loadAll(): Deck[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Deck[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(decks: Deck[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
}

function genId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function listDecks(): Deck[] {
  return loadAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getDeck(id: string): Deck | undefined {
  return loadAll().find((d) => d.id === id);
}

export function createDeck(input: Omit<Deck, "id" | "updatedAt">): Deck {
  const decks = loadAll();
  const deck: Deck = { ...input, id: genId(), updatedAt: Date.now() };
  decks.push(deck);
  saveAll(decks);
  return deck;
}

export function updateDeck(deck: Deck): Deck {
  const decks = loadAll();
  const idx = decks.findIndex((d) => d.id === deck.id);
  const next = { ...deck, updatedAt: Date.now() };
  if (idx >= 0) decks[idx] = next; else decks.push(next);
  saveAll(decks);
  return next;
}

export function deleteDeck(id: string): void {
  const decks = loadAll().filter((d) => d.id !== id);
  saveAll(decks);
}

// Legacy compact format, kept so previously shared codes remain importable.
interface SharePayloadV1 {
  v: 1;
  n: string;
  f: string;
  p?: string | null;
  pe: string[];
  d: [string, number][];
}

function fromSharePayload(p: SharePayloadV1): Omit<Deck, "id" | "updatedAt"> {
  return {
    name: p.n,
    faction: p.f,
    protagonist: p.p ?? null,
    persona: p.pe,
    deck: p.d.map(([id, qty]) => ({ id, qty } as DeckEntry)),
    backgroundImage: null,
  };
}

interface OfficialSharePayload {
  deckCards: Record<string, number>;
  faction: number;
  hasError: boolean;
  id: number;
  image: number;
  imageKey: string;
  name: string;
  personaDeck: Record<string, number>;
  protagonist: Record<string, number>;
}

const OFFICIAL_DECK_IMPORT_URL =
  "https://www.astraliachronicles.com/deck-import?deckData=";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function deflateToBase64Url(value: string): Promise<string> {
  const stream = new Blob([value])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  return toBase64Url(compressed);
}

async function cardKeysById(): Promise<Map<string, string>> {
  const cards = await readCardData();
  const canonicalCards = cards.filter(
    (card) => card.face === 1 && !isAlternativeArt(card)
  );
  const printKey = (setId: string) =>
    setId
      .replace(/\s(?:N|EX|P|SR|SSR)$/i, "")
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase();
  const canonicalImageByPrint = new Map(
    canonicalCards.map((card) => [printKey(card.setId), card.imageId.toUpperCase()])
  );

  return new Map(
    cards
      .filter((card) => card.face === 1)
      .map((card) => [
        card.id.toLowerCase(),
        isAlternativeArt(card)
          ? canonicalImageByPrint.get(printKey(card.setId)) ?? card.imageId.toUpperCase()
          : card.imageId.toUpperCase(),
      ])
  );
}

function toOfficialCardMap(
  cardIds: { id: string; qty: number }[],
  keysById: Map<string, string>
): Record<string, number> {
  return cardIds.reduce<Record<string, number>>((result, { id, qty }) => {
    const officialId = keysById.get(id.toLowerCase());
    if (!officialId) throw new Error(`Card not found in catalog: ${id}`);
    if (qty > 0) result[officialId] = qty;
    return result;
  }, {});
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function inflateBase64Url(value: string): Promise<string> {
  const bytes = fromBase64Url(value);
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
  const stream = new Blob([buffer])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"));
  return new Response(stream).text();
}

function getOfficialDeckData(value: string): string | null {
  try {
    const url = new URL(value);
    return url.searchParams.get("deckData");
  } catch {
    return null;
  }
}

async function fromOfficialSharePayload(
  payload: Partial<OfficialSharePayload>
): Promise<Omit<Deck, "id" | "updatedAt">> {
  if (!payload.deckCards || !payload.personaDeck || !payload.protagonist) {
    throw new Error("Unsupported official deck format");
  }

  const cards = await readCardData();
  const cardsByOfficialId = new Map(
    cards
      .filter((card) => card.face === 1)
      .map((card) => [card.imageId.toUpperCase(), card])
  );

  const getCard = (officialId: string) => {
    const card = cardsByOfficialId.get(officialId.toUpperCase());
    if (!card) throw new Error(`Card not found in catalog: ${officialId}`);
    return card;
  };

  const deck = Object.entries(payload.deckCards)
    .filter(([, qty]) => Number(qty) > 0)
    .map(([officialId, qty]) => ({ id: getCard(officialId).id, qty: Number(qty) }));

  const persona = Object.entries(payload.personaDeck)
    .filter(([, qty]) => Number(qty) > 0)
    .map(([officialId]) => getCard(officialId).id);

  const protagonistEntry = Object.entries(payload.protagonist).find(
    ([, qty]) => Number(qty) > 0
  );
  const protagonist = protagonistEntry ? getCard(protagonistEntry[0]) : null;
  const factionSource = protagonist ?? (deck[0] ? getCardFromId(deck[0].id, cards) : null);

  return {
    name: payload.name?.trim() || "New Deck",
    faction: factionSource?.faction.toLowerCase() || "red",
    protagonist: protagonist?.id ?? null,
    persona,
    deck,
    backgroundImage: null,
  };
}

function getCardFromId(id: string, cards: Awaited<ReturnType<typeof readCardData>>) {
  return cards.find((card) => card.face === 1 && card.id === id) ?? null;
}

export async function exportDeck(deck: Deck): Promise<string> {
  const keysById = await cardKeysById();
  const payload: OfficialSharePayload = {
    deckCards: toOfficialCardMap(deck.deck, keysById),
    // These fields are Android app resource IDs in links generated by the
    // official app. Card lists and name are portable; use neutral values for
    // metadata that is not available in this web app.
    faction: 0,
    hasError: false,
    id: 0,
    image: 0,
    imageKey: "",
    name: deck.name,
    personaDeck: toOfficialCardMap(
      deck.persona.map((id) => ({ id, qty: 1 })),
      keysById
    ),
    protagonist: deck.protagonist
      ? toOfficialCardMap([{ id: deck.protagonist, qty: 1 }], keysById)
      : {},
  };

  return `${OFFICIAL_DECK_IMPORT_URL}${await deflateToBase64Url(
    JSON.stringify(payload)
  )}`;
}

export async function importDeck(
  code: string
): Promise<Omit<Deck, "id" | "updatedAt">> {
  const trimmed = code.trim();
  const officialDeckData = getOfficialDeckData(trimmed);

  if (officialDeckData) {
    const json = await inflateBase64Url(officialDeckData);
    return fromOfficialSharePayload(JSON.parse(json) as OfficialSharePayload);
  }

  const json = new TextDecoder().decode(fromBase64(trimmed));
  const parsed = JSON.parse(json) as SharePayloadV1;
  if (!parsed || parsed.v !== 1) throw new Error("Unsupported deck format");
  return fromSharePayload(parsed);
}

export async function setDeckBackgroundImage(
  id: string,
  file: File
): Promise<Deck | undefined> {
  const deck = getDeck(id);
  if (!deck) return undefined;
  const dataUrl = await fileToDataUrl(file);
  deck.backgroundImage = dataUrl;
  return updateDeck(deck);
}

export function clearDeckBackgroundImage(id: string): Deck | undefined {
  const deck = getDeck(id);
  if (!deck) return undefined;
  deck.backgroundImage = null;
  return updateDeck(deck);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
