import { useState, useEffect } from "react";
import { getCardIdentity } from "../data/cardDataReader";
import { getCardFaces } from "../services/cardDataService";
import type { Card } from "../types/Card.ts";
import type { Deck } from "../types/Deck";
import { createDeck, updateDeck } from "../services/deckService";
import {
  addToSelection,
  buildDeckPayload,
  COPIES_PER_CARD,
  countSelectedCards,
  FACTIONS,
  removeFromSelection,
  SECTION_LIMITS,
  shuffleCards,
  type CardSelection,
  type DeckSection,
  type SelectedCard,
} from "../domain/deckBuilder";
import { useCardFilters } from "../hooks/useCardFilters";
import { useDeckCardOptions } from "../hooks/useDeckCardOptions";
import CardDisplay from "./CardDisplay";
import CardDetailsModal from "./CardDetailsModal";
import DeckBuilderSection from "./DeckBuilderSection";
import DeckStats from "./DeckStats";
import FactionSelection from "./FactionSelection";
import styles from "./DeckCreationModal.module.scss";

interface DeckCreationModalProps {
  onClose: () => void;
  initialDeck?: Deck;
  onSaved?: (deck: Deck) => void;
}

export default function DeckCreationModal({
  onClose,
  initialDeck,
  onSaved,
}: DeckCreationModalProps) {
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
  const [initialHand, setInitialHand] = useState<Card[]>([]);
  const [remainingDeck, setRemainingDeck] = useState<Card[]>([]);
  const [mulliganIndexes, setMulliganIndexes] = useState<number[]>([]);
  const [mulliganUsed, setMulliganUsed] = useState(false);

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

  useEffect(() => {
    // A displayed hand should never become misleading after the deck changes.
    setInitialHand([]);
    setRemainingDeck([]);
    setMulliganIndexes([]);
    setMulliganUsed(false);
  }, [deckSelectionMap]);

  const simulateInitialHand = () => {
    const deck = shuffleCards(
      Object.values(deckSelectionMap).flatMap(({ card, qty }) =>
        Array.from({ length: qty }, () => card)
      )
    );

    setInitialHand(deck.slice(0, 5));
    setRemainingDeck(deck.slice(5));
    setMulliganIndexes([]);
    setMulliganUsed(false);
  };

  const toggleMulliganCard = (index: number) => {
    if (mulliganUsed) return;
    setMulliganIndexes((current) =>
      current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index]
    );
  };

  const performMulligan = () => {
    if (
      mulliganUsed ||
      mulliganIndexes.length === 0 ||
      mulliganIndexes.length > remainingDeck.length
    )
      return;

    const selected = new Set(mulliganIndexes);
    const replacementCards = remainingDeck.slice(0, mulliganIndexes.length);
    let replacementIndex = 0;
    const nextHand = initialHand.map((card, index) =>
      selected.has(index) ? replacementCards[replacementIndex++] ?? card : card
    );
    const cardsToReturn = initialHand.filter((_, index) => selected.has(index));
    const nextDeck = shuffleCards(
      remainingDeck.slice(mulliganIndexes.length).concat(cardsToReturn)
    );

    setInitialHand(nextHand);
    setRemainingDeck(nextDeck);
    setMulliganIndexes([]);
    setMulliganUsed(true);
  };

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

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modal}>
        {detailCard && (
          <CardDetailsModal card={detailCard} onClose={closeCardDetails} />
        )}

        {!selectedFaction ? (
          <FactionSelection
            factions={[...FACTIONS]}
            onSelect={setSelectedFaction}
            onClose={onClose}
          />
        ) : (
          <>
            {(() => {
              const cap =
                (selectedFaction || "").charAt(0).toUpperCase() +
                (selectedFaction || "").slice(1);
              const factionClass =
                (styles[
                  `factionHeader${cap}` as keyof typeof styles
                ] as string) || "";
              return (
                <div className={`${styles.modalHeader} ${factionClass}`}>
                  <h2 className={styles.modalTitle}>
                    {selectedFaction.toUpperCase()} Deck Builder
                  </h2>
                  <div className={styles.headerActions}>
                    <button
                      className={styles.closeButton}
                      onClick={onClose}
                      aria-label="Close"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })()}

            <div className={styles.editorHeader}>
              <div className={styles.headerLeft}>
                <input
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  placeholder="Deck name"
                  className={styles.deckNameInput}
                />
                <input
                  id="deck-bg-input"
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () =>
                      setBackgroundImage(String(reader.result));
                    reader.readAsDataURL(file);
                    e.currentTarget.value = "";
                  }}
                />
                <button
                  className={styles.editButton}
                  onClick={() =>
                    document.getElementById("deck-bg-input")?.click()
                  }
                >
                  Set Background
                </button>
                {backgroundImage && (
                  <button
                    className={styles.editButton}
                    onClick={() => setBackgroundImage(null)}
                  >
                    Remove Background
                  </button>
                )}
              </div>

              <div className={styles.headerActions}>
                <button className={styles.editButton} onClick={handleSave}>
                  Save Deck
                </button>
              </div>
            </div>

            <DeckBuilderSection
              section="protagonist"
              title="Protagonist"
              editing={editing.protagonist}
              options={cardOptions.protagonist}
              filters={protagonistFilters}
              protagonist={protagonistSelection}
              selection={{}}
              identityLimit={1}
              onToggleEdit={() => toggleEdit("protagonist")}
              onAddCard={(card) => addCard("protagonist", card)}
              onRemoveCard={(card) => removeCard("protagonist", card)}
              onOpenCard={openCardDetails}
            />
            <DeckBuilderSection
              section="persona"
              title="Persona Cards"
              editing={editing.persona}
              options={cardOptions.persona}
              filters={personaFilters}
              protagonist={protagonistSelection}
              selection={personaSelectionMap}
              identityLimit={1}
              onToggleEdit={() => toggleEdit("persona")}
              onAddCard={(card) => addCard("persona", card)}
              onRemoveCard={(card) => removeCard("persona", card)}
              onOpenCard={openCardDetails}
            />
            <DeckBuilderSection
              section="deck"
              title="Deck Cards"
              editing={editing.deck}
              options={cardOptions.deck}
              filters={deckFilters}
              protagonist={protagonistSelection}
              selection={deckSelectionMap}
              identityLimit={COPIES_PER_CARD}
              onToggleEdit={() => toggleEdit("deck")}
              onAddCard={(card) => addCard("deck", card)}
              onRemoveCard={(card) => removeCard("deck", card)}
              onOpenCard={openCardDetails}
            />

            <section className={`${styles.section} ${styles.handSimulator}`}>
              <div className={styles.sectionHeader}>
                <div>
                  <h3>Opening Hand Simulator</h3>
                  <p className={styles.sectionHint}>
                    {initialHand.length && !mulliganUsed
                      ? "Select cards to replace, then mulligan once."
                      : "Draw 5 cards from your Main Deck, respecting card quantities."}
                  </p>
                </div>
                <button
                  className={styles.editButton}
                  onClick={() =>
                    initialHand.length > 0 &&
                    !mulliganUsed &&
                    mulliganIndexes.length > 0
                      ? performMulligan()
                      : simulateInitialHand()
                  }
                  disabled={countSelectedCards(deckSelectionMap) < 5}
                >
                  {!initialHand.length || mulliganUsed || mulliganIndexes.length === 0
                    ? "New Hand"
                    : `Mulligan Selected (${mulliganIndexes.length})`}
                </button>
              </div>
              {initialHand.length > 0 ? (
                <div className={styles.handGrid} aria-live="polite">
                  {initialHand.map((card, index) => (
                    <div
                      key={`${card.id}-${index}`}
                      className={`${styles.handCard} ${
                        mulliganIndexes.includes(index)
                          ? styles.mulliganCardSelected
                          : ""
                      }`}
                    >
                      <CardDisplay card={card} onClick={openCardDetails} />
                      <button
                        type="button"
                        className={styles.mulliganToggle}
                        aria-pressed={mulliganIndexes.includes(index)}
                        disabled={mulliganUsed}
                        onClick={() => toggleMulliganCard(index)}
                      >
                        {mulliganIndexes.includes(index) ? "Selected" : "Mulligan"}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.empty}>
                  Add at least 5 Main Deck cards to simulate an opening hand.
                </div>
              )}
            </section>

            <DeckStats
              entries={Object.values(deckSelectionMap)}
              limit={SECTION_LIMITS.deck}
            />
          </>
        )}
      </div>
    </div>
  );
}
