import { useEffect, useState } from "react";
import type { Card } from "../types/Card";
import { getCardImagePath } from "../services/cardImageService";
import styles from "./CardDetailsModal.module.scss";

interface Props {
  card: Card;
  onClose: () => void;
}

export default function CardDetailsModal({ card, onClose }: Props) {
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    setImageLoaded(false);
  }, [card.id]);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={`${styles.modal} ${imageLoaded ? styles.loaded : ""}`}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <button className={styles.close} onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className={styles.content}>
          {!imageLoaded && <div className={styles.loading}>Loading...</div>}
          <img
            src={getCardImagePath(card, "full")}
            alt={card.name}
            className={styles.image}
            onLoad={() => setImageLoaded(true)}
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
