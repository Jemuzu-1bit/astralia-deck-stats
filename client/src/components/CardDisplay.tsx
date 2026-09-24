import React, { useEffect, useRef, useState } from "react";
import type { Card } from "../types/Card.ts";
import { getCardImagePath } from "../services/cardImageService";
import { getCardFaces } from "../services/cardDataService";
import styles from "./CardDisplay.module.scss";

interface CardDisplayProps {
  card: Card;
  onClick?: (card: Card) => void;
  onInspect?: (card: Card | null) => void;
  enableFlip?: boolean;
}

const CardDisplay: React.FC<CardDisplayProps> = ({
  card,
  onClick,
  onInspect,
  enableFlip = true,
}) => {
  const [currentFace, setCurrentFace] = useState<Card>(card);
  const [backFace, setBackFace] = useState<Card | null>(null);
  const inspecting = useRef(false);

  useEffect(() => {
    (async () => {
      if (!enableFlip) return;
      const { back } = await getCardFaces(card.id);
      if (back) setBackFace(back);
    })();
  }, [card, enableFlip]);

  const handleFlip = () => {
    if (backFace) {
      const nextFace = currentFace.face === 1 ? backFace : card;
      setCurrentFace(nextFace);
      if (inspecting.current) onInspect?.(nextFace);
    }
  };

  const handleClick = () => {
    if (onClick) onClick(currentFace);
  };

  return (
    <div
      className={styles.cardDisplay}
      onClick={handleClick}
      onMouseEnter={() => { inspecting.current = true; onInspect?.(currentFace); }}
      onMouseLeave={() => { inspecting.current = false; onInspect?.(null); }}
      onFocus={() => { inspecting.current = true; onInspect?.(currentFace); }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          inspecting.current = false;
          onInspect?.(null);
        }
      }}
      tabIndex={onInspect ? 0 : undefined}
    >
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
