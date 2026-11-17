import { useEffect, useRef, useState } from "react";
import { useModalFocus } from "../hooks/useModalFocus";
import type { Card } from "../types/Card";
import { getCardImagePath } from "../services/cardImageService";
import styles from "./CardDetailsModal.module.scss";

interface Props {
  card: Card;
  onClose: () => void;
}

export default function CardDetailsModal({ card, onClose }: Props) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const modal = useRef<HTMLDivElement>(null);
  useModalFocus(modal);

  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [card.id]);

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
          {!imageLoaded && !imageError && <div className={styles.loading}>Loading...</div>}
          {imageError && <p role="status">Card artwork is unavailable.</p>}
          <img
            src={getCardImagePath(card, "full")}
            alt={card.name}
            className={styles.image}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            style={{ opacity: imageLoaded ? 1 : 0 }}
          />

          <div className={styles.info}>
            <h2 className={styles.name}>{card.name}</h2>
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
