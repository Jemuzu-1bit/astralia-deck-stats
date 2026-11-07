import { useEffect, useState } from "react";
import { getCardFaces } from "../../services/cardDataService";
import type { GameCard } from "../../services/gameConnection";
import type { ResolvedCard } from "./model";

export function useResolvedCards(items: GameCard[]): ResolvedCard[] {
  const [cards, setCards] = useState<ResolvedCard[]>([]);

  useEffect(() => {
    let active = true;
    setCards([]);
    Promise.all(items.map(async (gameCard) => {
      if (!gameCard.id) return { gameCard, card: null, canFlip: false };
      const { front, back } = await getCardFaces(gameCard.id);
      const card = gameCard.flipped ? back || front : front || back;
      return card ? { gameCard, card, canFlip: Boolean(front && back) } : null;
    })).then((loaded) => {
      if (active) setCards(loaded.filter((entry): entry is ResolvedCard => entry !== null));
    });
    return () => { active = false; };
  }, [items]);

  const currentItems = new Map(items.map((item) => [item.uid, item]));
  return cards.flatMap(({ gameCard, card, canFlip }) => {
    const current = currentItems.get(gameCard.uid);
    return current ? [{ gameCard: current, card, canFlip }] : [];
  });
}
