import { useEffect, useState } from "react";
import type { Card } from "../types/Card";
import { countSelectedCards, shuffleCards, type CardSelection } from "../domain/deckBuilder";
import CardDisplay from "./CardDisplay";
import styles from "./DeckCreationModal.module.scss";

export default function OpeningHandSimulator({ deckSelectionMap, onOpenCard }: { deckSelectionMap: CardSelection; onOpenCard: (card: Card) => void }) {
  const deckContentsKey = JSON.stringify(
    Object.values(deckSelectionMap)
      .map(({ card, qty }) => [card.id, qty])
      .sort(([a], [b]) => String(a).localeCompare(String(b)))
  );
  const [initialHand, setInitialHand] = useState<Card[]>([]);
  const [remainingDeck, setRemainingDeck] = useState<Card[]>([]);
  const [mulliganIndexes, setMulliganIndexes] = useState<number[]>([]);
  const [mulliganUsed, setMulliganUsed] = useState(false);


  useEffect(() => {
    // A displayed hand should never become misleading after the deck changes.
    setInitialHand([]);
    setRemainingDeck([]);
    setMulliganIndexes([]);
    setMulliganUsed(false);
  }, [deckContentsKey]);

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


  const openCardDetails = onOpenCard;
  return (
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

  );
}
