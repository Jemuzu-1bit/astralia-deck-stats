import { useEffect, useState } from "react";
import { getCardPrintingGroup } from "../data/cardDataReader";
import { getCardDeckSection } from "../domain/deckBuilder";
import { getAllCards } from "../services/cardDataService";
import type { Card } from "../types/Card";

interface DeckCardOptions {
  protagonist: Card[];
  persona: Card[];
  deck: Card[];
  printings: ReadonlyMap<string, readonly Card[]>;
}

const EMPTY_OPTIONS: DeckCardOptions = {
  protagonist: [],
  persona: [],
  deck: [],
  printings: new Map(),
};

async function loadOptions(faction: string): Promise<DeckCardOptions> {
  const cards = await getAllCards({ includePrintings: true });
  const targetFaction = faction.toLowerCase();
  const printings = new Map<string, Card[]>();
  for (const card of cards) {
    if (card.faction.toLowerCase() !== targetFaction) continue;
    const groupId = getCardPrintingGroup(card);
    const group = printings.get(groupId) ?? [];
    if (card.id.toLowerCase() === groupId) group.unshift(card);
    else group.push(card);
    printings.set(groupId, group);
  }

  const options: DeckCardOptions = { protagonist: [], persona: [], deck: [], printings };
  for (const [card] of printings.values()) {
    const section = getCardDeckSection(card);
    if (section) options[section].push(card);
  }
  return options;
}

export function useDeckCardOptions(faction: string | null): DeckCardOptions & { loading: boolean; error: string | null } {
  const [options, setOptions] = useState<DeckCardOptions>(EMPTY_OPTIONS);
  const [loading, setLoading] = useState(Boolean(faction));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!faction) {
      setOptions(EMPTY_OPTIONS);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);
    setOptions(EMPTY_OPTIONS);
    void loadOptions(faction).then((loadedOptions) => {
      if (active) setOptions(loadedOptions);
    }).catch(() => {
      if (active) setError("Could not load cards. Close and reopen the builder to try again.");
    }).finally(() => { if (active) setLoading(false); });

    return () => {
      active = false;
    };
  }, [faction]);

  return { ...options, loading, error };
}
