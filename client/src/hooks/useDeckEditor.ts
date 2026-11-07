import { useState, useEffect } from "react";
import { getCardIdentity } from "../data/cardDataReader";
import { getCardFaces } from "../services/cardDataService";
import type { Card } from "../types/Card";
import type { Deck } from "../types/Deck";
import { createDeck, updateDeck } from "../services/deckService";
import { addToSelection, buildDeckPayload, COPIES_PER_CARD, moveSelectedCard, removeFromSelection, SECTION_LIMITS, type CardSelection, type DeckSection, type SelectedCard } from "../domain/deckBuilder";
import { useCardFilters } from "../hooks/useCardFilters";
import { useDeckCardOptions } from "../hooks/useDeckCardOptions";

export function useDeckEditor({ initialDeck, onSaved, onClose }: { initialDeck?: Deck; onSaved?: (deck: Deck) => void; onClose: () => void }) {
  const [selectedFaction, setSelectedFaction] = useState<string | null>(
    initialDeck?.faction ?? null
  );
  const [deckName, setDeckName] = useState<string>(
    initialDeck?.name ?? "New Deck"
  );
  const [backgroundImage, setBackgroundImage] = useState<string | null>(
    initialDeck?.backgroundImage ?? null
  );

  const cardOptions = useDeckCardOptions(selectedFaction);

  const [protagonistSelection, setProtagonistSelection] =
    useState<SelectedCard | null>(null);
  const [personaSelectionMap, setPersonaSelectionMap] =
    useState<CardSelection>({});
  const [deckSelectionMap, setDeckSelectionMap] =
    useState<CardSelection>({});
  const [editing, setEditing] = useState<Record<DeckSection, boolean>>({
    protagonist: false,
    persona: false,
    deck: false,
  });

  const [detailCard, setDetailCard] = useState<Card | null>(null);
  const openCardDetails = (card: Card) => setDetailCard(card);
  const closeCardDetails = () => setDetailCard(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    if (!initialDeck) {
      return () => {
        active = false;
      };
    }
    if (
      !selectedFaction ||
      selectedFaction.toLowerCase() !== initialDeck.faction.toLowerCase()
    )
      return () => {
        active = false;
      };

    const tryPrefill = async () => {
      const [protagonistFaces, personaFaces, deckFaces] = await Promise.all([
        initialDeck.protagonist
          ? getCardFaces(initialDeck.protagonist)
          : Promise.resolve<{ front?: Card; back?: Card }>({}),
        Promise.all(initialDeck.persona.map(getCardFaces)),
        Promise.all(initialDeck.deck.map((entry) => getCardFaces(entry.id))),
      ]);
      if (!active) return;

      setProtagonistSelection(
        protagonistFaces.front ? { card: protagonistFaces.front, qty: 1 } : null
      );
      const pMap: CardSelection = {};
      for (const { front } of personaFaces) {
        if (front) pMap[front.id] = { card: front, qty: 1 };
      }
      const dMap: CardSelection = {};
      deckFaces.forEach(({ front }, index) => {
        if (!front) return;
        const existing = dMap[front.id];
        dMap[front.id] = {
          card: front,
          qty: Math.min(
            COPIES_PER_CARD,
            (existing?.qty ?? 0) + initialDeck.deck[index].qty
          ),
        };
      });
      setDeckSelectionMap(dMap);
      setPersonaSelectionMap(pMap);
      setBackgroundImage(initialDeck.backgroundImage ?? null);
    };
    void tryPrefill();
    return () => {
      active = false;
    };
  }, [initialDeck, selectedFaction]);

  const toggleEdit = (section: DeckSection) => {
    setEditing((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const protagonistFilters = useCardFilters();
  const personaFilters = useCardFilters();
  const deckFilters = useCardFilters();

  const addCard = (section: DeckSection, card: Card) => {
    if (section === "protagonist") {
      setProtagonistSelection({ card, qty: 1 });
      return;
    }

    const updateSelection = section === "persona"
      ? setPersonaSelectionMap
      : setDeckSelectionMap;
    const identityLimit = section === "persona" ? 1 : COPIES_PER_CARD;
    updateSelection((current) =>
      addToSelection(current, card, SECTION_LIMITS[section], identityLimit)
    );
  };

  const removeCard = (section: DeckSection, card: Card) => {
    if (section === "protagonist") {
      setProtagonistSelection((prev) =>
        prev && getCardIdentity(prev.card) === getCardIdentity(card)
          ? null
          : prev
      );
      return;
    }

    const updateSelection = section === "persona"
      ? setPersonaSelectionMap
      : setDeckSelectionMap;
    updateSelection((current) => removeFromSelection(current, card));
  };

  const moveCard = (section: "persona" | "deck", cardId: string, targetId: string) => {
    const updateSelection = section === "persona"
      ? setPersonaSelectionMap
      : setDeckSelectionMap;
    updateSelection((current) => moveSelectedCard(current, cardId, targetId));
  };

  const handleSave = () => {
    if (!selectedFaction) {
      alert("Please select a faction first.");
      return;
    }

    const payload = buildDeckPayload({
      name: deckName,
      faction: selectedFaction,
      protagonist: protagonistSelection,
      persona: personaSelectionMap,
      deck: deckSelectionMap,
      backgroundImage,
    });
    let saved: Deck;
    if (initialDeck) {
      saved = updateDeck({
        ...payload,
        id: initialDeck.id,
        updatedAt: Date.now(),
      });
    } else {
      saved = createDeck(payload);
    }
    onSaved?.(saved);
    onClose();
  };

  return { selectedFaction, setSelectedFaction, deckName, setDeckName, backgroundImage, setBackgroundImage, cardOptions, protagonistSelection, personaSelectionMap, deckSelectionMap, editing, detailCard, openCardDetails, closeCardDetails, protagonistFilters, personaFilters, deckFilters, toggleEdit, addCard, removeCard, moveCard, handleSave };
}
