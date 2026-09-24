import React, { useEffect, useState } from "react";
import type { Card } from "../types/Card.ts";
import { getCardImagePath } from "../services/cardImageService";
import { getCardFaces } from "../services/cardDataService";
import styles from "./CardDisplay.module.scss";

interface CardDisplayProps {
  card: Card;
  onClick?: (card: Card) => void;
  enableFlip?: boolean;
}

const CardDisplay: React.FC<CardDisplayProps> = ({
  card,
  onClick,
  enableFlip = true,
}) => {
  const [currentFace, setCurrentFace] = useState<Card>(card);
  const [backFace, setBackFace] = useState<Card | null>(null);

  useEffect(() => {
    (async () => {
      if (!enableFlip) return;
      const { back } = await getCardFaces(card.id);
      if (back) setBackFace(back);
    })();
  }, [card, enableFlip]);

  const handleFlip = () => {
    if (backFace) {
      setCurrentFace((prev) => (prev.face === 1 ? backFace : card));
    }
  };

  const handleClick = () => {
    if (onClick) onClick(currentFace);
  };

  return (
    <div className={styles.cardDisplay} onClick={handleClick}>
      <img
        src={getCardImagePath(currentFace, "thumb")}
        srcSet={`${getCardImagePath(currentFace, "thumb")} 320w`}
        sizes="(max-width: 640px) 92px, 160px"
        alt={currentFace.name}
        className={styles.cardImage}
        loading="lazy"
        decoding="async"
        width={160}
        height={224}
      />
      {backFace && enableFlip && (
        <button
          className={styles.flipButton}
          onClick={(e) => {
            e.stopPropagation();
            handleFlip();
          }}
        >
          Flip
        </button>
      )}
    </div>
  );
};

export default CardDisplay;
