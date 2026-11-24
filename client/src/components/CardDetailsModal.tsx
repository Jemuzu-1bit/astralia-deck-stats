import { useRef, useState } from "react";
import { getCardRarity } from "../data/cardDataReader";
import { useModalFocus } from "../hooks/useModalFocus";
import type { Card } from "../types/Card";
import { getCardImagePath } from "../services/cardImageService";
import styles from "./CardDetailsModal.module.scss";

interface Props {
  card: Card;
  onClose: () => void;
  printings?: readonly Card[];
  onChoosePrinting?: (card: Card) => void;
}

const printingSetLabels: Readonly<Record<string, string>> = {
  KS: "Kickstarter promo",
  LS: "Legacy Art",
  SD: "Structure Deck",
  SG: "Stained Glass",
  SP: "Seasonal promo",
};

function CardArtwork({ source, name }: { source: string; name: string }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  return <div className={styles.artwork}>
    {!imageLoaded && !imageError && <p className={styles.loading} role="status">Loading…</p>}
    {imageError && <p className={styles.loading} role="status">Card artwork is unavailable.</p>}
    <img src={source} alt={name} className={styles.image}
      onLoad={() => setImageLoaded(true)}
      onError={() => setImageError(true)}
      style={{ opacity: imageLoaded ? 1 : 0 }} />
  </div>;
}

export default function CardDetailsModal({ card, onClose, printings = [], onChoosePrinting }: Props) {
  const modal = useRef<HTMLDivElement>(null);
  useModalFocus(modal);
  const source = getCardImagePath(card, "full");

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        ref={modal}
        role="dialog"
        aria-modal="true"
        aria-label={card.name}
        tabIndex={-1}
        className={`${styles.modal} ${styles.loaded}`}
        onKeyDown={(event) => {
          if (event.key === "Escape") { event.stopPropagation(); onClose(); }
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <button className={styles.close} onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className={styles.content}>
          <CardArtwork key={source} source={source} name={card.name} />

          <div className={styles.info}>
            <h2 className={styles.name}>{card.name}</h2>
            {onChoosePrinting && printings.length > 1 ? (
              <fieldset className={styles.printings}>
                <legend>Card printing</legend>
                <p>Applies to every copy of this card in the deck.</p>
                <div className={styles.printingChoices}>
                  {printings.map(printing => (
                    <button key={printing.id} type="button" aria-pressed={printing.id === card.id}
                      onClick={() => onChoosePrinting(printing)}>
                      <img src={getCardImagePath(printing)} alt="" width={42} height={59} />
                      <span>
                        <strong>{printingSetLabels[printing.setId.split("-")[0]] ?? getCardRarity(printing)}</strong>
                        <small>{printing.setId}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : <p className={styles.setId}>{card.setId}</p>}
            <div className={styles.meta}>
              {card.cost !== undefined && <span>Cost: {card.cost}</span>}
              {card.type && <span>Type: {card.type}</span>}
              {card.subtype && <span>Subtype: {card.subtype}</span>}
            </div>

            {card.description && (
              <div className={styles.description}>
                {card.description.split("\n").map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            )}

            {card.keywords && (
              <div className={styles.keywords}>
                <div className={styles.keywordsLabel}>Keywords</div>
                <div className={styles.keywordChips}>
                  {card.keywords.split(",").map((keyword, i) => (
                    <span key={i} className={styles.keywordChip}>
                      {keyword.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
