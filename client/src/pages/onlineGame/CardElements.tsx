import { type CSSProperties, type DragEvent, type MouseEvent } from "react";
import type { GameCard } from "../../services/gameConnection";
import { getCardImagePath } from "../../services/cardImageService";
import normalCardBack from "../../assets/N_Back.png";
import { ZONE_NAMES, type CardDrag, type CardMenu, type CombatAction, type InspectCard, type ResolvedCard, type ZoneName } from "./model";
import { useResolvedCards } from "./useResolvedCards";
import styles from "../OnlineGamePage.module.scss";

export function CardThumb({ entry, hidden = false, canAttack = false, canBlock = false, combatSelected = null, onInspect, onDragStart, onDragEnd, onMenu, onActivate, className = "", style }: {
  entry: ResolvedCard;
  hidden?: boolean;
  canAttack?: boolean;
  canBlock?: boolean;
  combatSelected?: CombatAction | null;
  onInspect: InspectCard;
  onDragStart?: CardDrag;
  onDragEnd?: () => void;
  onMenu?: CardMenu;
  onActivate?: (card: GameCard) => void;
  className?: string;
  style?: CSSProperties;
}) {
  return <button
    className={className}
    style={style}
    type="button"
    data-card-uid={entry.gameCard.uid}
    data-can-flip={entry.canFlip ? "true" : undefined}
    data-is-action={entry.card?.type.toLowerCase() === "action" ? "true" : undefined}
    aria-label={`${hidden || entry.gameCard.faceDown ? "Face-down card" : `Inspect ${entry.card?.name ?? "card"}${entry.gameCard.revealed ? ", revealed" : ""}`}${combatSelected ? `. Selected to ${combatSelected}; choose an opponent card or click the same section to cancel` : `${canAttack ? ". Click the top quarter to declare attacker" : ""}${canBlock ? ". Click the bottom quarter to declare blocker" : ""}`}${entry.gameCard.ownerRole ? ", controlled by another player" : ""}`}
    aria-pressed={canAttack || canBlock ? Boolean(combatSelected) : undefined}
    draggable={Boolean(onDragStart)}
    onDragStart={(event) => onDragStart?.(event, entry.gameCard)}
    onDragEnd={onDragEnd}
    onContextMenu={(event) => onMenu?.(event, entry.gameCard, entry.card, entry.canFlip)}
    onMouseEnter={() => onInspect(hidden || entry.gameCard.faceDown ? null : entry.card)}
    onMouseLeave={() => onInspect(null)}
    onFocus={() => onInspect(hidden || entry.gameCard.faceDown ? null : entry.card)}
    onBlur={() => onInspect(null)}
    onClick={() => { if (onActivate) onActivate(entry.gameCard); else onInspect(hidden || entry.gameCard.faceDown ? null : entry.card); }}
  >
    <img
      src={hidden || entry.gameCard.faceDown || !entry.card ? normalCardBack : getCardImagePath(entry.card, "thumb")}
      alt=""
      draggable={false}
    />
    {combatSelected ? <span className={`${styles.combatSelectedBadge} ${combatSelected === "block" ? styles.blockSelectedBadge : styles.attackSelectedBadge}`} aria-hidden="true">{combatSelected === "attack" ? "Attacker selected" : "Blocker selected"}</span>
      : <>
        {canAttack && <span className={`${styles.combatHoverZone} ${styles.attackHoverZone}`} aria-hidden="true"><span className={`${styles.combatHint} ${styles.attackHint}`}>Declare Attacker</span></span>}
        {canBlock && <span className={`${styles.combatHoverZone} ${styles.blockHoverZone}`} aria-hidden="true"><span className={`${styles.combatHint} ${styles.blockHint}`}>Declare Blocker</span></span>}
      </>}
    {entry.gameCard.revealed && <span className={styles.revealedBadge}>Shown</span>}
    {entry.gameCard.ownerRole && <span className={styles.controlledBadge}>Controlled</span>}
  </button>;
}

export function DeckStack({ count }: { count: number }) {
  if (count === 0) return <span className={styles.emptyText}>Empty</span>;
  return <div className={styles.deckStack} aria-label={`${count} cards`}>
    {[2, 1, 0].map((offset) => <img
      key={offset}
      src={normalCardBack}
      alt="Card back"
      style={{ transform: `translate(${offset * 3}px, ${offset * -3}px)` }}
    />)}
    <b>{count}</b>
  </div>;
}

export function DeckZone({ count, local, owner, onDraw, onMenu, onDragOver, onDrop }: {
  count: number;
  local: boolean;
  owner: "self" | "opponent";
  onDraw: () => void;
  onMenu: (event: MouseEvent<HTMLDivElement>) => void;
  onDragOver?: (event: DragEvent<HTMLElement>) => void;
  onDrop?: (event: DragEvent<HTMLElement>) => void;
}) {
  return <div
    className={`${styles.zone} ${local ? styles.deckZone : ""}`}
    data-deck-owner={owner}
    role={local ? "button" : undefined}
    tabIndex={local ? 0 : undefined}
    aria-label={local ? `Main deck, ${count} cards. Click to draw one card.` : `Main deck, ${count} cards`}
    onClick={local && count > 0 ? onDraw : undefined}
    onKeyDown={local && count > 0 ? (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onDraw(); }
    } : undefined}
    onContextMenu={onMenu}
    onDragOver={onDragOver}
    onDrop={onDrop}
  >
    <span className={styles.zoneLabel}>Main deck</span>
    <div className={styles.zoneContent}><DeckStack count={count} /></div>
  </div>;
}

export function CardStack({ items, spread = false, onInspect, onDragStart, onDragEnd, onMenu }: {
  items: GameCard[];
  spread?: boolean;
  onInspect: InspectCard;
  onDragStart?: CardDrag;
  onDragEnd?: () => void;
  onMenu?: CardMenu;
}) {
  const cards = useResolvedCards(items);
  if (items.length === 0) return <span className={styles.emptyText}>Empty</span>;
  return <div className={styles.publicStack}>
    {cards.map((entry, index) => {
      const progress = cards.length === 1 ? .5 : index / (cards.length - 1);
      return <CardThumb
        key={entry.gameCard.uid}
        entry={entry}
        onInspect={onInspect}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onMenu={onMenu}
        className={styles.stackCard}
        style={spread
          ? { left: `${progress * 100}%`, transform: `translateX(-${progress * 100}%)`, zIndex: index + 1 }
          : { left: `${Math.min(index, 6) * 7}px`, zIndex: index + 1 }}
      />;
    })}
    <b>{items.length}</b>
  </div>;
}

export function ActionStage({ items, local, onInspect, onDragStart, onDragEnd, onMenu }: {
  items: GameCard[];
  local: boolean;
  onInspect: InspectCard;
  onDragStart: CardDrag;
  onDragEnd: () => void;
  onMenu: CardMenu;
}) {
  const cards = useResolvedCards(items);
  if (items.length === 0) return null;

  return <div className={styles.actionStage} aria-label={`Played actions, ${items.length}`}>
    {cards.map((entry) => <CardThumb
      key={entry.gameCard.uid}
      entry={entry}
      onInspect={onInspect}
      onDragStart={local ? onDragStart : undefined}
      onDragEnd={local ? onDragEnd : undefined}
      onMenu={local ? onMenu : undefined}
      className={styles.actionCard}
    />)}
  </div>;
}

export function Zone({ ariaLabel, children, className = "", onDragOver, onDrop, onContextMenu }: {
  ariaLabel: string;
  children?: React.ReactNode;
  className?: string;
  onDragOver?: (event: DragEvent<HTMLElement>) => void;
  onDrop?: (event: DragEvent<HTMLElement>) => void;
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
}) {
  return <div className={`${styles.zone} ${className}`} aria-label={ariaLabel} onDragOver={onDragOver} onDrop={onDrop} onContextMenu={onContextMenu}>
    <div className={styles.zoneContent}>{children}</div>
  </div>;
}

export function CardZone({ name, items, movable, onInspect, onOpen, onDragStart, onDragEnd, onMenu, onDragOver, onDrop }: {
  name: ZoneName;
  items: GameCard[];
  movable: boolean;
  onInspect: InspectCard;
  onOpen: () => void;
  onDragStart: CardDrag;
  onDragEnd: () => void;
  onMenu: CardMenu;
  onDragOver?: (event: DragEvent<HTMLElement>) => void;
  onDrop?: (event: DragEvent<HTMLElement>) => void;
}) {
  return <div
    className={`${styles.zone} ${styles.expandableZone}`}
    role="button"
    tabIndex={0}
    aria-label={`Show ${ZONE_NAMES[name]}, ${items.length} cards`}
    onClick={onOpen}
    onKeyDown={(event) => {
      if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault(); onOpen();
      }
    }}
    onMouseLeave={() => onInspect(null)}
    onDragOver={onDragOver}
    onDrop={onDrop}
  >
    <span className={styles.zoneLabel}>{ZONE_NAMES[name]}</span>
    <div className={styles.zoneContent}>
      <CardStack
        items={items}
        spread={name === "persona"}
        onInspect={onInspect}
        onDragStart={movable ? onDragStart : undefined}
        onDragEnd={movable ? onDragEnd : undefined}
        onMenu={movable ? onMenu : undefined}
      />
    </div>
  </div>;
}
