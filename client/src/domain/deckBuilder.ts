import { getCardIdentity } from "../data/cardDataReader";
import type { AugCard } from "../types/AugCard";
import type { Card } from "../types/Card";
import type { Deck } from "../types/Deck";

export const FACTIONS = ["red", "blue", "green", "purple", "pink"] as const;
export const CARDS_PER_DECK = 45;
export const PERSONA_LIMIT = 5;
export const COPIES_PER_CARD = 4;

export type DeckSection = "protagonist" | "persona" | "deck";

export interface SelectedCard {
  card: Card;
  qty: number;
}

export type CardSelection = Record<string, SelectedCard>;

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
};

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
  identityLimit: number
): CardSelection {
  if (
    countSelectedCards(selection) >= totalLimit ||
    countCardIdentity(selection, card) >= identityLimit
  ) {
    return selection;
  }

  const existing = selection[card.id];
  return {
    ...selection,
    [card.id]: { card, qty: (existing?.qty ?? 0) + 1 },
  };
}

export function removeFromSelection(
  selection: CardSelection,
  card: Card
): CardSelection {
  const existing = selection[card.id];
  if (!existing) return selection;

  if (existing.qty > 1) {
    return {
      ...selection,
      [card.id]: { ...existing, qty: existing.qty - 1 },
    };
  }

  const remaining = { ...selection };
  delete remaining[card.id];
  return remaining;
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
  faction,
  protagonist,
  persona,
  deck,
  backgroundImage,
}: {
  name: string;
  faction: string;
  protagonist: SelectedCard | null;
  persona: CardSelection;
  deck: CardSelection;
  backgroundImage: string | null;
}): Omit<Deck, "id" | "updatedAt"> {
  const remainingByIdentity = new Map<string, number>();
  const deckEntries = Object.values(deck).flatMap((item) => {
    const identity = getCardIdentity(item.card);
    const remaining = remainingByIdentity.get(identity) ?? COPIES_PER_CARD;
    const qty = Math.min(item.qty, remaining);
    remainingByIdentity.set(identity, remaining - qty);
    return qty > 0 ? [{ id: item.card.id, qty }] : [];
  });

  return {
    name: name.trim() || "New Deck",
    faction,
    protagonist: protagonist?.card.id ?? null,
    persona: Object.values(persona).map((item) => item.card.id),
    deck: deckEntries,
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
