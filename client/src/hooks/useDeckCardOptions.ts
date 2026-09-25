import { useEffect, useState } from "react";
import { getCardFaces, getCardsByField } from "../services/cardDataService";
import type { AugCard } from "../types/AugCard";
import type { Card } from "../types/Card";

interface DeckCardOptions {
  protagonist: AugCard[];
  persona: AugCard[];
  deck: AugCard[];
}

const EMPTY_OPTIONS: DeckCardOptions = {
  protagonist: [],
  persona: [],
  deck: [],
};

function uniqueValues(values: Array<string | undefined>): string {
  const normalizedValues = values
    .flatMap((value) => (value ?? "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set(normalizedValues)].join(",");
}

async function augmentCard(card: Card): Promise<AugCard> {
  try {
    const { back } = await getCardFaces(card.id);
    return {
      ...card,
      mergedKeywords: uniqueValues([card.keywords, back?.keywords]),
      mergedAtk: uniqueValues([card.atk, back?.atk]),
      mergedHp: uniqueValues([card.hp, back?.hp]),
    };
  } catch {
    return card;
  }
}

async function loadOptions(faction: string): Promise<DeckCardOptions> {
  const [protagonists, personas, deckCards] = await Promise.all([
    getCardsByField("mainDeck", "Protagonist"),
    getCardsByField("mainDeck", "Persona"),
    getCardsByField("mainDeck", "Deck"),
  ]);
  const targetFaction = faction.toLowerCase();
  const augmentFactionCards = (cards: Card[]) =>
    Promise.all(
      cards
        .filter((card) => card.faction.toLowerCase() === targetFaction)
        .map(augmentCard)
    );

  const [protagonist, persona, deck] = await Promise.all([
    augmentFactionCards(protagonists),
    augmentFactionCards(personas),
    augmentFactionCards(deckCards),
  ]);
  return { protagonist, persona, deck };
}

export function useDeckCardOptions(faction: string | null): DeckCardOptions {
  const [options, setOptions] = useState<DeckCardOptions>(EMPTY_OPTIONS);

  useEffect(() => {
    let active = true;
    if (!faction) {
      setOptions(EMPTY_OPTIONS);
      return () => {
        active = false;
      };
    }

    void loadOptions(faction).then((loadedOptions) => {
      if (active) setOptions(loadedOptions);
    });

    return () => {
      active = false;
    };
  }, [faction]);

  return options;
}
