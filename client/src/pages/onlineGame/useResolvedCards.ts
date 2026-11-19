import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readCardData } from "../../data/cardDataReader";
import type { GameCard } from "../../services/gameConnection";
import type { Card } from "../../types/Card";
import type { ResolvedCard } from "./model";

const CardFaces = createContext<ReadonlyMap<string, { front?: Card; back?: Card }>>(new Map());

export function GameCardDataProvider({ children }: { children: ReactNode }) {
  const [cards, setCards] = useState<Card[]>([]);

  useEffect(() => {
    let active = true;
    void readCardData().then((loaded) => { if (active) setCards(loaded); }).catch((error: unknown) => console.error("Could not load game cards", error));
    return () => { active = false; };
  }, []);

  const faces = useMemo(() => {
    const index = new Map<string, { front?: Card; back?: Card }>();
    for (const card of cards) {
      if (!card.id) continue;
      const key = card.id.toLowerCase();
      const entry = index.get(key) ?? {};
      if (card.face === 1) entry.front ??= card;
      if (card.face === 2) entry.back ??= card;
      index.set(key, entry);
    }
    return index;
  }, [cards]);

  return createElement(CardFaces.Provider, { value: faces }, children);
}

export function useResolvedCards(items: GameCard[]): ResolvedCard[] {
  const faces = useContext(CardFaces);
  return useMemo(() => items.flatMap<ResolvedCard>((gameCard) => {
    if (!gameCard.id) return [{ gameCard, card: null, canFlip: false }];
    const { front, back } = faces.get(gameCard.id.toLowerCase()) ?? {};
    const card = gameCard.flipped ? back || front : front || back;
    return card ? [{ gameCard, card, canFlip: Boolean(front && back) }] : [];
  }), [faces, items]);
}
