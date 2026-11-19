import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { gameConnection, type GameCard, type GameTable, type LobbyPlayerState } from "../../services/gameConnection";
import type { CardMenu, CardStat, CombatAction, CombatSelection, InspectCard, ZoneName } from "./model";
import { previewSlot, useGameDrop, type CardDragPreview, type GameDrop } from "./cardDrag";
import { CardZone, DeckZone, Zone, CardThumb } from "./CardElements";
import { FrazzleCounter, StatCounter, CustomCounter } from "./CardIndicators";
import { useResolvedCards } from "./useResolvedCards";
import styles from "../OnlineGamePage.module.scss";

export function PlayerTable({ player, table, opponentSide, readOnly, attachingUid, combatSelection, dragPreview, onInspect, onOpenZone, onOpenSlot, onDrawDeck, onDeckMenu, onCardFrazzleAdjust, onCardStatAdjust, onAttachTarget, onMenu }: {
  player: LobbyPlayerState | null;
  table: GameTable;
  opponentSide?: boolean;
  readOnly?: boolean;
  attachingUid: string | null;
  combatSelection: CombatSelection | null;
  dragPreview?: CardDragPreview | null;
  onInspect: InspectCard;
  onOpenZone: (name: ZoneName) => void;
  onOpenSlot: (zone: "battle" | "protagonist", slot?: number) => void;
  onDrawDeck: () => void;
  onDeckMenu: (event: MouseEvent<HTMLDivElement>, owner: "self" | "opponent") => void;
  onCardFrazzleAdjust: (uid: string, delta: -1 | 1) => void;
  onCardStatAdjust: (uid: string, stat: CardStat, delta: -1 | 1) => void;
  onAttachTarget: (targetUid: string) => void;
  onMenu: CardMenu;
}) {
  const movable = !readOnly && !opponentSide && Boolean(player?.table);
  const protagonistIndex = opponentSide ? 1 : 4;
  // Each battle slot is stored from its owner's point of view. The opponent's
  // grid is rotated by 180 degrees, so logical slots must be rendered in the
  // reverse visual order (slot 0 at the opposite corner, and so on).
  const battleSlots = opponentSide ? [5, 4, 3, 2, 0] : [0, 1, 2, 3, 5];
  const sideZone = (name: ZoneName) => <CardZone
    name={name}
    items={table[name]}
    movable={movable}
    onInspect={onInspect}
    onOpen={() => onOpenZone(name)}
    onMenu={onMenu}
  />;

  return <section className={`${styles.tableHalf} ${opponentSide ? styles.opponentHalf : styles.playerHalf}`}>
    <div className={styles.playerBadge}>
      <strong>{player?.name || "Waiting…"}</strong>
      <span>{player?.deckName || "No deck"}</span>
    </div>
    <div className={`${styles.sideZones} ${styles.leftZones}`}>
      {opponentSide ? <>{sideZone("persona")}{sideZone("oblivion")}</> : <>{sideZone("oblivion")}{sideZone("persona")}</>}
    </div>
    <div className={styles.battleGrid}>
      {Array.from({ length: 6 }).map((_, visualIndex) => {
        if (visualIndex === protagonistIndex) return <Zone
          key={visualIndex}
          ariaLabel="Protagonist"
          className={styles.protagonistSlot}
          target={movable ? { zone: "protagonist" } : undefined}
        >
          <SlotStack
            items={table.protagonist}
            zone="protagonist"
            dragPreview={dragPreview}
            onOpen={() => onOpenSlot("protagonist")}
            movable={movable}
            attachingUid={attachingUid}
            combatSelection={combatSelection}
            onInspect={onInspect}
            onMenu={onMenu}
            onFrazzleAdjust={onCardFrazzleAdjust}
            onStatAdjust={onCardStatAdjust}
            onAttachTarget={onAttachTarget}
          />
        </Zone>;
        const slot = battleSlots.indexOf(visualIndex);
        const items = table.battle[slot] ?? [];
        return <Zone
          key={visualIndex}
          ariaLabel="Battle"
          className={styles.battleSlot}
          target={movable ? { zone: "battle", slot } : undefined}
        >
          <SlotStack
            items={items}
            zone="battle"
            slot={slot}
            dragPreview={dragPreview}
            onOpen={() => onOpenSlot("battle", slot)}
            movable={movable}
            attachingUid={attachingUid}
            combatSelection={combatSelection}
            onInspect={onInspect}
            onMenu={onMenu}
            onFrazzleAdjust={onCardFrazzleAdjust}
            onStatAdjust={onCardStatAdjust}
            onAttachTarget={onAttachTarget}
          />
        </Zone>;
      })}
    </div>
    <div className={`${styles.sideZones} ${styles.rightZones}`}>
      {opponentSide ? <>
        {sideZone("graveyard")}
        <DeckZone count={player?.deckCount ?? table.deck.length} local={false} owner="opponent" onDraw={onDrawDeck} onMenu={(event) => onDeckMenu(event, "opponent")} />
      </> : <>
        <DeckZone
          count={player?.deckCount ?? table.deck.length}
          local={movable}
          owner="self"
          onDraw={onDrawDeck}
          onMenu={(event) => onDeckMenu(event, "self")}
        />
        {sideZone("graveyard")}
      </>}
    </div>
  </section>;
}

function SlotStack({ items, zone, slot, dragPreview, movable, attachingUid, combatSelection, onOpen, onInspect, onMenu, onFrazzleAdjust, onStatAdjust, onAttachTarget }: {
  items: GameCard[];
  zone: "battle" | "protagonist";
  slot?: number;
  dragPreview?: CardDragPreview | null;
  movable: boolean;
  attachingUid: string | null;
  combatSelection: CombatSelection | null;
  onOpen: () => void;
  onInspect: InspectCard;
  onMenu: CardMenu;
  onFrazzleAdjust: (uid: string, delta: -1 | 1) => void;
  onStatAdjust: (uid: string, stat: CardStat, delta: -1 | 1) => void;
  onAttachTarget: (targetUid: string) => void;
}) {
  const [subslotIndex, setSubslotIndex] = useState(0);
  const [visibleSubslotCount, setVisibleSubslotCount] = useState(1);
  const subslotViewportRef = useRef<HTMLDivElement>(null);
  const subslotCount = Math.max(0, items.length - 1);
  const visibleCount = Math.min(subslotCount, visibleSubslotCount);
  const maxSubslotIndex = Math.max(0, subslotCount - visibleCount);
  const visibleSubslotIndex = Math.min(subslotIndex, maxSubslotIndex);
  const mainTarget = movable && items[0] ? { zone, slot, targetUid: items[0].uid } : undefined;
  const mainDrop = useGameDrop(mainTarget);
  const firstVisibleSubslot = items[visibleSubslotIndex + 1];
  const subslotDrop = useGameDrop(movable && firstVisibleSubslot ? { zone, slot, targetUid: firstVisibleSubslot.uid } : undefined);
  // Keep each drop target tied to its actual slot while showing the new card order.
  const displayedItems = previewSlot(items, dragPreview);
  const protagonist = zone === "protagonist";

  useEffect(() => {
    const viewport = subslotViewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setVisibleSubslotCount(width >= 138 ? 3 : width >= 91 ? 2 : 1);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [subslotCount]);

  if (items.length === 0) return <span className={styles.emptyText}>Empty</span>;

  const renderCard = (item: GameCard, className: string, target?: GameDrop) => <BattleCard
    item={item}
    movable={movable}
    combatSelected={combatSelection?.uid === item.uid ? combatSelection.action : null}
    menuEnabled={movable}
    frazzleEditable={movable}
    target={target ? { ...target, attachToCard: true } : undefined}
    attachTargetEnabled={movable && attachingUid !== null && attachingUid !== item.uid}
    onInspect={onInspect}
    onMenu={onMenu}
    onFrazzleAdjust={onFrazzleAdjust}
    onStatAdjust={onStatAdjust}
    onAttachTarget={onAttachTarget}
    className={className}
  />;

  return <div className={`${styles.slotStack} ${protagonist ? styles.protagonistStack : ""} ${items.length === 1 ? styles.soloStack : ""}`}>
    {items.length > 1 && <button
      type="button"
      className={styles.slotViewButton}
      onClick={onOpen}
      aria-label={`Show all ${items.length} cards in this ${protagonist ? "Protagonist" : "Battle"} slot`}
    >Cards · {items.length}</button>}
    <div className={styles.attachedStack} aria-label={`${items.length} cards in stack`}>
      {subslotCount > 0 && <div {...subslotDrop} className={styles.subslotCarousel} role="group" aria-label={`Sub slot: ${subslotCount} cards`}>
        <div ref={subslotViewportRef} className={styles.subslotViewport}>
          <div
            className={styles.subslotTrack}
            data-visible={visibleCount}
            style={maxSubslotIndex > 0 ? { transform: `translateX(calc(-${visibleSubslotIndex * 100 / visibleCount}% - ${visibleSubslotIndex * 3 / visibleCount}px))` } : undefined}
          >
            {items.slice(1).map((item, index) => <div
              key={item.uid}
              className={styles.subslotItem}
              inert={index < visibleSubslotIndex || index >= visibleSubslotIndex + visibleCount}
              aria-hidden={index < visibleSubslotIndex || index >= visibleSubslotIndex + visibleCount}
            >{renderCard(displayedItems[index + 1], styles.attachedCard, movable ? { zone, slot, targetUid: item.uid } : undefined)}</div>)}
          </div>
        </div>
        {subslotCount > visibleCount && <div className={styles.subslotControls}>
          <button type="button" aria-label="Previous sub slot card" disabled={visibleSubslotIndex === 0} onClick={() => setSubslotIndex(Math.max(0, visibleSubslotIndex - 1))}>‹</button>
          <button type="button" aria-label="Next sub slot card" disabled={visibleSubslotIndex === maxSubslotIndex} onClick={() => setSubslotIndex(Math.min(maxSubslotIndex, visibleSubslotIndex + 1))}>›</button>
        </div>}
      </div>}
      <div {...mainDrop} className={styles.slotMainArea} role="group" aria-label="Main slot">{renderCard(displayedItems[0], styles.slotMain, mainTarget)}</div>
    </div>
  </div>;
}

export function BattleCard({ item, movable, combatSelected = null, menuEnabled = movable, frazzleEditable = movable, target, attachTargetEnabled = false, onInspect, onMenu, onFrazzleAdjust, onStatAdjust, onAttachTarget, className = "", style }: {
  item: GameCard;
  movable: boolean;
  combatSelected?: CombatAction | null;
  menuEnabled?: boolean;
  frazzleEditable?: boolean;
  target?: GameDrop;
  attachTargetEnabled?: boolean;
  onInspect: InspectCard;
  onMenu: CardMenu;
  onFrazzleAdjust: (uid: string, delta: -1 | 1) => void;
  onStatAdjust: (uid: string, stat: CardStat, delta: -1 | 1) => void;
  onAttachTarget: (targetUid: string) => void;
  className?: string;
  style?: CSSProperties;
}) {
  const items = useMemo(() => [item], [item]);
  const cards = useResolvedCards(items);
  const drop = useGameDrop(target);
  return cards[0] && <div
    {...drop}
    className={`${styles.battleCardWrap} ${attachTargetEnabled ? styles.attachTarget : ""} ${combatSelected === "attack" ? styles.attackSelected : combatSelected === "block" ? styles.blockSelected : ""} ${className}`}
    style={style}
  >
    <CardThumb
      entry={cards[0]}
      canAttack={movable && !item.faceDown && !attachTargetEnabled && (item.frazzle || 0) === 0}
      canBlock={movable && !item.faceDown && !attachTargetEnabled && (item.frazzle || 0) === 0}
      combatSelected={combatSelected}
      onInspect={onInspect}
      movable={movable}
      onMenu={menuEnabled ? onMenu : undefined}
      onActivate={attachTargetEnabled ? () => onAttachTarget(item.uid) : undefined}
      className={styles.battleCard}
    />
    <FrazzleCounter
      uid={item.uid}
      value={item.frazzle || 0}
      editable={frazzleEditable}
      onAdjust={(delta) => onFrazzleAdjust(item.uid, delta)}
    />
    {!item.faceDown && item.atk !== undefined && <StatCounter
      uid={item.uid}
      stat="atk"
      value={item.atk}
      editable={frazzleEditable}
      onAdjust={(delta) => onStatAdjust(item.uid, "atk", delta)}
    />}
    {!item.faceDown && item.hp !== undefined && <StatCounter
      uid={item.uid}
      stat="hp"
      value={item.hp}
      editable={frazzleEditable}
      onAdjust={(delta) => onStatAdjust(item.uid, "hp", delta)}
    />}
    {Boolean(item.counters?.length) && <div className={`${styles.customCounterList} ${item.revealed ? styles.countersBelowRevealed : ""}`} aria-label="Custom counters">
      {item.counters?.map((counter) => <CustomCounter
        uid={item.uid}
        key={`${counter.kind}:${counter.label.toLocaleLowerCase()}:${counter.emoji || ""}`}
        counter={counter}
        editable={frazzleEditable}
        onAdjust={(delta) => gameConnection.adjustCardCounter(item.uid, counter, delta)}
      />)}
    </div>}
  </div>;
}
