import type { Deck } from "../types/Deck";
import { COPIES_PER_CARD, FACTIONS, SECTION_LIMITS } from "../domain/deckBuilder";
import { useDeckEditor } from "../hooks/useDeckEditor";
import CardDetailsModal from "./CardDetailsModal";
import DeckBuilderSection from "./DeckBuilderSection";
import DeckStats from "./DeckStats";
import FactionSelection from "./FactionSelection";
import OpeningHandSimulator from "./OpeningHandSimulator";
import styles from "./DeckCreationModal.module.scss";

interface DeckCreationModalProps {
  onClose: () => void;
  initialDeck?: Deck;
  onSaved?: (deck: Deck) => void;
}

export default function DeckCreationModal({ onClose, initialDeck, onSaved }: DeckCreationModalProps) {
  const { selectedFaction, setSelectedFaction, deckName, setDeckName, backgroundImage, setBackgroundImage, cardOptions, protagonistSelection, personaSelectionMap, deckSelectionMap, editing, detailCard, openCardDetails, closeCardDetails, protagonistFilters, personaFilters, deckFilters, toggleEdit, addCard, removeCard, moveCard, handleSave } = useDeckEditor({ initialDeck, onSaved, onClose });

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
              onMoveCard={(cardId, targetId) => moveCard("persona", cardId, targetId)}
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
              onMoveCard={(cardId, targetId) => moveCard("deck", cardId, targetId)}
            />

            <OpeningHandSimulator deckSelectionMap={deckSelectionMap} onOpenCard={openCardDetails} />

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
