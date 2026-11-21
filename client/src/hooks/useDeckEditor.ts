import { useState, useEffect } from "react";
import { getCardIdentity } from "../data/cardDataReader";
import { getCardFaces } from "../services/cardDataService";
import type { Card } from "../types/Card";
import type { Deck, DeckEntry } from "../types/Deck";
import { saveLocalDeck } from "../services/deckService";
import { addDeckCard, buildDeckPayload, canAddDeckCard, getCardDeckSection, getDeckCardCopyLimit, moveSelectedCard, otherDeckSection, removeFromSelection, transferDeckCard, type CardSelection, type DeckCardSection, type DeckCardSelections, type DeckSection, type SelectedCard } from "../domain/deckBuilder";
import { useDeckCardOptions } from "../hooks/useDeckCardOptions";

function loadSelection(section: DeckCardSection, entries: DeckEntry[], faces: { front?: Card }[], copiesByIdentity: Map<string, number>): CardSelection {
  const selection: CardSelection = {};
  faces.forEach(({ front }, index) => {
    if (!front) return;
    const home = getCardDeckSection(front);
    if ((home !== "deck" && home !== "persona") || (section !== home && section !== "sideboard")) return;
    const identity = getCardIdentity(front);
    const copies = copiesByIdentity.get(identity) ?? 0;
    const qty = Math.min(getDeckCardCopyLimit(front) - copies, entries[index].qty);
    if (qty <= 0 && (section !== "sideboard" || entries[index].qty !== 0)) return;
    selection[front.id] = { card: front, qty: (selection[front.id]?.qty ?? 0) + qty };
    copiesByIdentity.set(identity, copies + qty);
  });
  return selection;
}

export function useDeckEditor({ initialDeck, initialFaction, sideboardEnabled, onSaved, onClose, saveDeck, suppressEscape = false }: { initialDeck?: Deck; initialFaction?: string; sideboardEnabled: boolean; onSaved?: (deck: Deck) => void; onClose: () => void; saveDeck?: (deck: Omit<Deck, "id" | "updatedAt">, initialDeck?: Deck) => Promise<Deck>; suppressEscape?: boolean }) {
  const [loadingDeck, setLoadingDeck] = useState(Boolean(initialDeck));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedFaction, setSelectedFaction] = useState<string | null>(
    initialDeck?.faction ?? initialFaction ?? null
  );
  const [deckName, setDeckName] = useState<string>(
    initialDeck?.name ?? "New Deck"
  );
  const [description, setDescription] = useState(initialDeck?.description ?? "");
  const [backgroundImage, setBackgroundImage] = useState<string | null>(
    initialDeck?.backgroundImage ?? null
  );

  const cardOptions = useDeckCardOptions(selectedFaction);

  const [protagonistSelection, setProtagonistSelection] =
    useState<SelectedCard | null>(null);
  const [deckSelections, setDeckSelections] = useState<DeckCardSelections>({ persona: {}, deck: {}, sideboard: {} });

  const [detailCard, setDetailCard] = useState<Card | null>(null);
  const openCardDetails = (card: Card) => setDetailCard(card);
  const closeCardDetails = () => setDetailCard(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !suppressEscape) {
        if (detailCard) closeCardDetails();
        else onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose, detailCard, suppressEscape]);

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
      const sideboard = sideboardEnabled ? initialDeck.sideboard ?? [] : [];
      const [protagonistFaces, personaFaces, deckFaces, sideboardFaces] = await Promise.all([
        initialDeck.protagonist
          ? getCardFaces(initialDeck.protagonist)
          : Promise.resolve<{ front?: Card; back?: Card }>({}),
        Promise.all(initialDeck.persona.map(getCardFaces)),
        Promise.all(initialDeck.deck.map((entry) => getCardFaces(entry.id))),
        Promise.all(sideboard.map((entry) => getCardFaces(entry.id))),
      ]);
      if (!active) return;

      setProtagonistSelection(
        protagonistFaces.front ? { card: protagonistFaces.front, qty: 1 } : null
      );
      const copiesByIdentity = new Map<string, number>();
      setDeckSelections({
        persona: loadSelection("persona", initialDeck.persona.map(id => ({ id, qty: 1 })), personaFaces, copiesByIdentity),
        deck: loadSelection("deck", initialDeck.deck, deckFaces, copiesByIdentity),
        sideboard: loadSelection("sideboard", sideboard, sideboardFaces, copiesByIdentity),
      });
      setBackgroundImage(initialDeck.backgroundImage ?? null);
    };
    setLoadingDeck(true);
    setLoadError(null);
    void tryPrefill().catch(() => {
      if (active) setLoadError("Could not load this deck. Close and reopen it to try again.");
    }).finally(() => { if (active) setLoadingDeck(false); });
    return () => {
      active = false;
    };
  }, [initialDeck, selectedFaction, sideboardEnabled]);

  const canAddCard = (section: DeckSection, card: Card) => {
    if (section === "protagonist") return getCardDeckSection(card) === "protagonist"
      && (!protagonistSelection || getCardIdentity(protagonistSelection.card) !== getCardIdentity(card));
    return canAddDeckCard(deckSelections, section, card);
  };

  const addCard = (section: DeckSection, card: Card, insertionIndex?: number) => {
    if (section === "protagonist") {
      if (getCardDeckSection(card) === section) setProtagonistSelection({ card, qty: 1 });
      return;
    }
    setDeckSelections(current => addDeckCard(current, section, card, insertionIndex));
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

    setDeckSelections(current => {
      const selection = removeFromSelection(current[section], card, section === "sideboard");
      return selection === current[section] ? current : { ...current, [section]: selection };
    });
  };

  const discardEmptySideboardCard = (card: Card) => {
    setDeckSelections(current => current.sideboard[card.id]?.qty === 0
      ? { ...current, sideboard: removeFromSelection(current.sideboard, card) }
      : current);
  };

  const moveCard = (from: DeckCardSection, to: DeckCardSection, card: Card, insertionIndex: number) => {
    setDeckSelections(current => {
      if (from === to) {
        const ordered = moveSelectedCard(current[from], card.id, insertionIndex);
        return ordered === current[from] ? current : { ...current, [from]: ordered };
      }
      return otherDeckSection(from, card) === to ? transferDeckCard(current, from, card, insertionIndex) : current;
    });
  };

  const handleSave = async () => {
    if (saving || loadingDeck || loadError || cardOptions.loading || cardOptions.error) return;
    if (!selectedFaction) {
      alert("Please select a faction first.");
      return;
    }

    const payload = buildDeckPayload({
      name: deckName,
      description,
      faction: selectedFaction,
      protagonist: protagonistSelection,
      ...deckSelections,
      backgroundImage,
    });
    setSaving(true);
    setSaveError(null);
    try {
      const saved = saveDeck
        ? await saveDeck(payload, initialDeck)
        : await saveLocalDeck(payload, initialDeck);
      onSaved?.(saved);
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save the deck.");
    } finally {
      setSaving(false);
    }
  };

  return { selectedFaction, setSelectedFaction, deckName, setDeckName, description, setDescription, backgroundImage, setBackgroundImage, cardOptions, protagonistSelection, deckSelections, detailCard, openCardDetails, closeCardDetails, canAddCard, addCard, removeCard, discardEmptySideboardCard, moveCard, handleSave, saving, saveError, loadingDeck, loadError };
}
