import type { Deck, DeckEntry } from "../types/Deck";

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

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

function encodeBase64(value: string): string {
  return toBase64(new TextEncoder().encode(value));
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function exportDeck(deck: Deck): Promise<string> {
  const payload: SharePayloadV1 = {
    v: 1,
    n: deck.name,
    f: deck.faction,
    p: deck.protagonist,
    pe: deck.persona,
    d: deck.deck.map(({ id, qty }) => [id, qty]),
  };

  return encodeBase64(JSON.stringify(payload));
}

export async function importDeck(
  code: string
): Promise<Omit<Deck, "id" | "updatedAt">> {
  const trimmed = code.trim();
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
