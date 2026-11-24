import type { Deck, DeckEntry } from "../types/Deck";
import { getCardPrintingGroup, readCardData } from "../data/cardDataReader.ts";
import { withoutSideboard } from "../domain/deckBuilder.ts";
import { deflateToBase64Url, inflateBase64Url, parseLocalSharePayload, type LocalSharePayloadV2 } from "./deckShareCodec.ts";

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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      throw new Error("Browser storage is full. Try a smaller cover or reset a cover on a saved deck.", { cause: error });
    }
    throw error;
  }
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

export function mergeLocalDecks(imported: Deck[]): number {
  const decks = loadAll();
  const ids = new Set(decks.map((deck) => deck.id));
  let added = 0;
  for (const deck of imported) {
    if (ids.has(deck.id)) continue;
    decks.push(withoutSideboard(deck));
    ids.add(deck.id);
    added++;
  }
  if (added) saveAll(decks);
  return added;
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

export async function saveLocalDeck(input: Omit<Deck, "id" | "updatedAt">, initialDeck?: Deck): Promise<Deck> {
  const cover = input.backgroundImage;
  const backgroundImage = cover && cover !== initialDeck?.backgroundImage ? await optimizeDeckCover(cover) : cover;
  const deck = { ...input, backgroundImage };
  return initialDeck ? updateDeck({ ...deck, id: initialDeck.id, updatedAt: initialDeck.updatedAt }) : createDeck(deck);
}

const COVER_MAX_LENGTH = 256 * 1024;
const COVER_MAX_DIMENSION = 1200;

async function isAnimatedPng(dataUrl: string): Promise<boolean> {
  const png = new DataView(await (await fetch(dataUrl)).arrayBuffer());
  for (let offset = 8; offset + 12 <= png.byteLength;) {
    const chunkType = png.getUint32(offset + 4);
    if (chunkType === 0x6163544c) return true; // acTL precedes the first IDAT chunk.
    if (chunkType === 0x49444154) break; // IDAT
    offset += png.getUint32(offset) + 12;
  }
  return false;
}

async function optimizeDeckCover(dataUrl: string): Promise<string> {
  if (dataUrl.length <= COVER_MAX_LENGTH || !/^data:image\/(?:jpeg|png);base64,/i.test(dataUrl)) return dataUrl;
  if (dataUrl.startsWith("data:image/png;") && await isAnimatedPng(dataUrl)) return dataUrl;

  const image = new Image();
  image.src = dataUrl;
  try { await image.decode(); }
  catch { throw new Error("Could not open this cover image. Try another image."); }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (context) {
    const originalDimension = Math.max(image.naturalWidth, image.naturalHeight);
    for (let dimension = Math.min(COVER_MAX_DIMENSION, originalDimension); dimension > 0; dimension = Math.floor(dimension * 0.7)) {
      canvas.width = Math.max(1, Math.round(image.naturalWidth * dimension / originalDimension));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * dimension / originalDimension));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const encoded = canvas.toDataURL("image/webp", 0.82);
      if (encoded.startsWith("data:image/") && encoded.length <= COVER_MAX_LENGTH) return encoded;
    }
  }
  throw new Error("Could not resize this cover image. Try a smaller image.");
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

function fromSharePayload(p: SharePayloadV1 | LocalSharePayloadV2): Omit<Deck, "id" | "updatedAt"> {
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

const OFFICIAL_DECK_IMPORT_URL = "https://www.astraliachronicles.com/deck-import?deckData=";

async function cardKeysById(): Promise<Map<string, string>> {
  const cards = await readCardData();
  const fronts = new Map(cards.filter(card => card.face === 1).map(card => [card.id.toLowerCase(), card]));
  return new Map(Array.from(fronts, ([id, card]) => {
    const officialCard = fronts.get(getCardPrintingGroup(card)) ?? card;
    return [id, officialCard.imageId.toUpperCase()];
  }));
}

function toOfficialCardMap(cardIds: { id: string; qty: number }[], keysById: Map<string, string>): Record<string, number> {
  return cardIds.reduce<Record<string, number>>((result, { id, qty }) => {
    const officialId = keysById.get(id.toLowerCase());
    if (!officialId) throw new Error(`Card not found in catalog: ${id}`);
    if (qty > 0) result[officialId] = (result[officialId] ?? 0) + qty;
    return result;
  }, {});
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function getOfficialDeckData(value: string): string | null {
  try {
    const url = new URL(value);
    return url.searchParams.get("deckData");
  } catch {
    return null;
  }
}

function getLocalDeckData(value: string): string | null {
  try {
    return new URL(value).searchParams.get("deck");
  } catch {
    return null;
  }
}

async function fromLocalSharePayload(payload: LocalSharePayloadV2): Promise<Omit<Deck, "id" | "updatedAt">> {
  const cards = await readCardData();
  const knownIds = new Set(cards.filter((card) => card.face === 1).map((card) => card.id.toLowerCase()));
  for (const id of [payload.p, ...payload.pe, ...payload.d.map(([cardId]) => cardId)]) {
    if (id && !knownIds.has(id.toLowerCase())) throw new Error(`Card not found in catalog: ${id}`);
  }
  return fromSharePayload(payload);
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
    faction: 0,
    hasError: false,
    id: 0,
    image: 0,
    imageKey: "",
    name: deck.name,
    personaDeck: toOfficialCardMap(deck.persona.map((id) => ({ id, qty: 1 })), keysById),
    protagonist: deck.protagonist
      ? toOfficialCardMap([{ id: deck.protagonist, qty: 1 }], keysById)
      : {},
  };
  return `${OFFICIAL_DECK_IMPORT_URL}${await deflateToBase64Url(JSON.stringify(payload))}`;
}

export async function importDeck(
  code: string
): Promise<Omit<Deck, "id" | "updatedAt">> {
  const trimmed = code.trim();
  const localDeckData = getLocalDeckData(trimmed);
  if (localDeckData) {
    const json = await inflateBase64Url(localDeckData);
    return fromLocalSharePayload(parseLocalSharePayload(JSON.parse(json)));
  }
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

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
