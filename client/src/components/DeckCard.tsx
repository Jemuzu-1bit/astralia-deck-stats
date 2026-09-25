import { useState } from "react";
import type { Deck } from "../types/Deck";
import DeckCreationModal from "./DeckCreationModal.tsx";
import styles from "./DeckCard.module.scss";

interface DeckCardProps {
  deck?: Deck;
  isAddButton?: boolean;
  onAddSaved?: (deck: Deck) => void;
  onEdit?: (deck: Deck) => void;
  onDelete?: (deck: Deck) => void;
  onShare?: (deck: Deck) => void;
}

export default function DeckCard({
  deck,
  isAddButton,
  onAddSaved,
  onEdit,
  onDelete,
  onShare,
}: DeckCardProps) {
  const [showModal, setShowModal] = useState(false);

  const factionMap: Record<string, string> = {
    red: styles.factionRed,
    blue: styles.factionBlue,
    green: styles.factionGreen,
    purple: styles.factionPurple,
    pink: styles.factionPink,
  };

  const factionClass = deck?.faction
    ? factionMap[deck.faction.toLowerCase()] ?? ""
    : "";

  const handleClick = () => {
    if (isAddButton) {
      setShowModal(true);
    } else if (deck) {
      onEdit?.(deck);
    }
  };

  return (
    <>
      <div
        className={`${styles.card} ${isAddButton ? styles.addCard : ""} ${
          !isAddButton && factionClass ? factionClass : ""
        }`}
        onClick={handleClick}
      >
        {isAddButton ? (
          "+"
        ) : (
          <div
            className={styles.cardInner}
            style={
              deck?.backgroundImage
                ? {
                    backgroundImage: `url(${deck.backgroundImage})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
          >
            <div className={styles.cardTitle}>
              {deck?.name || "Unnamed Deck"}
            </div>
            <div className={styles.actions}>
              <button
                className={`${styles.action} ${styles.primary}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (deck) onShare?.(deck);
                }}
              >
                Share
              </button>
              <button
                className={`${styles.action} ${styles.danger}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (deck) onDelete?.(deck);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <DeckCreationModal
          onClose={() => setShowModal(false)}
          onSaved={(d) => {
            setShowModal(false);
            onAddSaved?.(d);
          }}
        />
      )}
    </>
  );
}
