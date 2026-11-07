import { useEffect, useMemo, useRef } from "react";
import type { GameCard } from "../../services/gameConnection";
import type { CardDrag, CardMenu, InspectCard, SlotRailControls } from "./model";
import { CardThumb } from "./CardElements";
import { BattleCard } from "./PlayerTable";
import { useResolvedCards } from "./useResolvedCards";
import styles from "../OnlineGamePage.module.scss";

export function CardRail({ items, label, searchQuery, sortByName = false, faceUpUids, slotControls, onInspect, onDragStart, onDragEnd, onMenu }: {
  items: GameCard[];
  label: string;
  searchQuery?: string;
  sortByName?: boolean;
  faceUpUids?: ReadonlySet<string>;
  slotControls?: SlotRailControls;
  onInspect: InspectCard;
  onDragStart?: CardDrag;
  onDragEnd?: () => void;
  onMenu?: CardMenu;
}) {
  const cards = useResolvedCards(items);
  const railRef = useRef<HTMLDivElement>(null);
  const visibleCards = useMemo(() => {
    const query = searchQuery?.trim().toLocaleLowerCase();
    const filtered = query
      ? cards.filter(({ card }) => card && [
        card.name, card.setId, card.type, card.subtype, card.keywords, card.description,
      ].some((value) => value?.toLocaleLowerCase().includes(query)))
      : cards;
    if (!sortByName) return filtered;
    return [...filtered].sort((a, b) =>
      (a.card?.name ?? "").localeCompare(b.card?.name ?? "", undefined, { sensitivity: "base" })
      || (a.card?.setId ?? "").localeCompare(b.card?.setId ?? "", undefined, { sensitivity: "base" }));
  }, [cards, searchQuery, sortByName]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const scrollHorizontally = (event: WheelEvent) => {
      if (rail.scrollWidth <= rail.clientWidth) return;

      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (delta === 0) return;

      event.preventDefault();
      rail.scrollLeft += delta;
    };

    rail.addEventListener("wheel", scrollHorizontally, { passive: false });
    return () => rail.removeEventListener("wheel", scrollHorizontally);
  }, []);

  return <div ref={railRef} className={`${styles.hand} ${slotControls ? styles.handSlotCards : ""}`} aria-label={label}>
    {faceUpUids && items.length > 0 && <span className={styles.deckEdgeLabel}>Top</span>}
    {visibleCards.map((entry) => slotControls ? <BattleCard
      key={entry.gameCard.uid}
      item={entry.gameCard}
      movable={slotControls.movable}
      combatSelected={slotControls.combatSelection?.uid === entry.gameCard.uid ? slotControls.combatSelection.action : null}
      menuEnabled={slotControls.movable}
      frazzleEditable={slotControls.movable}
      attachTargetEnabled={slotControls.movable && slotControls.attachingUid !== null && slotControls.attachingUid !== entry.gameCard.uid}
      onInspect={onInspect}
      onDragStart={(event, card) => onDragStart?.(event, card)}
      onDragEnd={() => onDragEnd?.()}
      onMenu={(event, card, resolved, canFlip) => onMenu?.(event, card, resolved, canFlip)}
      onFrazzleAdjust={slotControls.onFrazzleAdjust}
      onStatAdjust={slotControls.onStatAdjust}
      onAttachDrop={slotControls.onAttachDrop}
      onAttachTarget={slotControls.onAttachTarget}
    /> : <CardThumb
      key={entry.gameCard.uid}
      entry={entry}
      hidden={faceUpUids !== undefined && !faceUpUids.has(entry.gameCard.uid)}
      onInspect={onInspect}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMenu={onMenu}
    />)}
    {faceUpUids && items.length > 0 && <span className={styles.deckEdgeLabel}>Bottom</span>}
    {items.length === 0 && <span className={styles.emptyText}>Empty</span>}
    {items.length > 0 && cards.length > 0 && visibleCards.length === 0 && <span className={styles.emptyText}>No matches</span>}
  </div>;
}
