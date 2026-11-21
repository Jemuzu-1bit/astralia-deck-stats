import { getCardIdentity } from "../data/cardDataReader.ts";
import type { AugCard } from "../types/AugCard";
import type { Card } from "../types/Card";
import type { Deck } from "../types/Deck";

export const FACTIONS = ["green", "red", "blue", "pink", "purple"] as const;
export const CARDS_PER_DECK = 45;
export const PERSONA_LIMIT = 5;
export const COPIES_PER_CARD = 4;

export function withoutSideboard<T extends Pick<Deck, "sideboard">>(deck: T): Omit<T, "sideboard"> {
  const copy = { ...deck };
  delete copy.sideboard;
  return copy;
}

export type DeckCardSection = "persona" | "deck" | "sideboard";
export type DeckSection = "protagonist" | DeckCardSection;

export interface SelectedCard {
  card: Card;
  qty: number;
}

export type CardSelection = Record<string, SelectedCard>;
export type DeckCardSelections = Record<DeckCardSection, CardSelection>;

export interface CardFilterValues {
  searchText: string;
  selectedCosts: string[];
  selectedTypes: string[];
  selectedSubtypes: string[];
  selectedKeywords: string[];
  selectedAtks: string[];
  selectedHps: string[];
}

export const SECTION_LIMITS: Record<DeckSection, number> = {
  protagonist: 1,
  persona: PERSONA_LIMIT,
  deck: CARDS_PER_DECK,
  sideboard: Infinity,
};

export const SECTION_LABELS: Record<DeckSection, string> = {
  protagonist: "Protagonist",
  persona: "Persona Deck",
  deck: "Main Deck",
  sideboard: "Sideboard",
};

export function getCardDeckSection(card: Pick<Card, "mainDeck">): Exclude<DeckSection, "sideboard"> | undefined {
  switch (card.mainDeck?.toLowerCase()) {
    case "protagonist": return "protagonist";
    case "persona": return "persona";
    case "deck": return "deck";
  }
}

export function getDeckCardCopyLimit(card: Pick<Card, "mainDeck">): number {
  return getCardDeckSection(card) === "persona" ? 1 : COPIES_PER_CARD;
}

export function countSelectedCards(selection: CardSelection): number {
  return Object.values(selection).reduce((total, item) => total + item.qty, 0);
}

export function countCardIdentity(
  selection: CardSelection,
  card: Card
): number {
  const identity = getCardIdentity(card);
  return Object.values(selection).reduce(
    (total, item) =>
      total + (getCardIdentity(item.card) === identity ? item.qty : 0),
    0
  );
}

export function addToSelection(
  selection: CardSelection,
  card: Card,
  totalLimit: number,
  identityLimit: number,
  insertionIndex?: number
): CardSelection {
  if (
    countSelectedCards(selection) >= totalLimit ||
    countCardIdentity(selection, card) >= identityLimit
  ) {
    return selection;
  }

  const entry = { card, qty: (selection[card.id]?.qty ?? 0) + 1 };
  if (insertionIndex === undefined) return { ...selection, [card.id]: entry };

  const entries = Object.entries(selection).filter(([id]) => id !== card.id);
  entries.splice(insertionIndex, 0, [card.id, entry]);
  return Object.fromEntries(entries);
}

export function otherDeckSection(section: DeckCardSection, card: Card): DeckCardSection | undefined {
  const home = getCardDeckSection(card);
  if (home !== "deck" && home !== "persona") return;
  if (section === "sideboard") return home;
  if (section === home) return "sideboard";
}

export function canAddDeckCard(selections: DeckCardSelections, section: DeckCardSection, card: Card): boolean {
  const home = getCardDeckSection(card);
  if ((home !== "deck" && home !== "persona") || (section !== home && section !== "sideboard")) return false;
  return countSelectedCards(selections[section]) < SECTION_LIMITS[section]
    && countCardIdentity(selections[home], card) + countCardIdentity(selections.sideboard, card) < getDeckCardCopyLimit(card);
}

export function addDeckCard(
  selections: DeckCardSelections,
  section: DeckCardSection,
  card: Card,
  insertionIndex?: number,
): DeckCardSelections {
  if (!canAddDeckCard(selections, section, card)) return selections;
  const selection = addToSelection(selections[section], card, SECTION_LIMITS[section], getDeckCardCopyLimit(card), insertionIndex);
  return { ...selections, [section]: selection };
}

export function transferDeckCard(selections: DeckCardSelections, from: DeckCardSection, card: Card, insertionIndex?: number): DeckCardSelections {
  const to = otherDeckSection(from, card);
  if (!to || !selections[from][card.id]?.qty) return selections;
  const removed = { ...selections, [from]: removeFromSelection(selections[from], card, from === "sideboard") };
  const moved = addDeckCard(removed, to, card, insertionIndex);
  return moved === removed ? selections : moved;
}

export function removeFromSelection(
  selection: CardSelection,
  card: Card,
  keepEmpty = false,
): CardSelection {
  const existing = selection[card.id];
  if (!existing) return selection;

  if (keepEmpty && existing.qty === 0) return selection;
  if (existing.qty > 1 || keepEmpty) {
    return {
      ...selection,
      [card.id]: { ...existing, qty: existing.qty - 1 },
    };
  }

  const remaining = { ...selection };
  delete remaining[card.id];
  return remaining;
}

export function moveSelectedCard(
  selection: CardSelection,
  cardId: string,
  target: string | number,
): CardSelection {
  const entries = Object.entries(selection);
  const from = entries.findIndex(([id]) => id === cardId);
  const to = typeof target === "number" ? Math.min(target, entries.length - 1) : entries.findIndex(([id]) => id === target);
  if (from < 0 || to < 0 || from === to) return selection;

  const [entry] = entries.splice(from, 1);
  entries.splice(to, 0, entry);
  return Object.fromEntries(entries);
}

function commaSeparatedValues(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function filterCards(
  cards: AugCard[],
  filters: CardFilterValues
): AugCard[] {
  const query = filters.searchText.trim().toLowerCase();

  return cards.filter((card) => {
    if (
      query &&
      !card.name.toLowerCase().includes(query) &&
      !card.id.toLowerCase().includes(query)
    ) {
      return false;
    }

    if (
      filters.selectedCosts.length > 0 &&
      !filters.selectedCosts.includes(card.cost)
    ) {
      return false;
    }
    if (
      filters.selectedTypes.length > 0 &&
      !filters.selectedTypes.includes(card.type)
    ) {
      return false;
    }
    if (
      filters.selectedSubtypes.length > 0 &&
      !filters.selectedSubtypes.includes(card.subtype)
    ) {
      return false;
    }

    const includesSelectedValue = (
      selectedValues: string[],
      cardValues: string[]
    ) =>
      selectedValues.length === 0 ||
      selectedValues.some((value) => cardValues.includes(value.toLowerCase()));

    return (
      includesSelectedValue(
        filters.selectedKeywords,
        commaSeparatedValues(card.mergedKeywords ?? card.keywords)
      ) &&
      includesSelectedValue(
        filters.selectedAtks,
        commaSeparatedValues(card.mergedAtk ?? card.atk)
      ) &&
      includesSelectedValue(
        filters.selectedHps,
        commaSeparatedValues(card.mergedHp ?? card.hp)
      )
    );
  });
}

export function buildDeckPayload({
  name,
  description = "",
  faction,
  protagonist,
  persona,
  deck,
  sideboard = {},
  backgroundImage,
}: {
  name: string;
  description?: string;
  faction: string;
  protagonist: SelectedCard | null;
  persona: CardSelection;
  deck: CardSelection;
  sideboard?: CardSelection;
  backgroundImage: string | null;
}): Omit<Deck, "id" | "updatedAt"> {
  const remainingByIdentity = new Map(Object.values(persona).map(({ card }) => [getCardIdentity(card), 0]));
  const toEntries = (selection: CardSelection, keepEmpty = false) => Object.values(selection).flatMap((item) => {
    if (keepEmpty && item.qty === 0) return [{ id: item.card.id, qty: 0 }];
    const identity = getCardIdentity(item.card);
    const remaining = remainingByIdentity.get(identity) ?? getDeckCardCopyLimit(item.card);
    const qty = Math.min(item.qty, remaining);
    remainingByIdentity.set(identity, remaining - qty);
    return qty > 0 ? [{ id: item.card.id, qty }] : [];
  });
  const deckEntries = toEntries(deck);
  const sideboardEntries = toEntries(sideboard, true);

  return {
    name: name.trim() || "New Deck",
    description: description.trim(),
    faction,
    protagonist: protagonist?.card.id ?? null,
    persona: Object.values(persona).map((item) => item.card.id),
    deck: deckEntries,
    ...(sideboardEntries.length ? { sideboard: sideboardEntries } : {}),
    backgroundImage,
  };
}

export function shuffleCards<T>(cards: readonly T[]): T[] {
  const shuffled = [...cards];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}
