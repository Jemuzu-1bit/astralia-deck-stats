import { useLayoutEffect, useRef } from "react";
import { useDndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import type { Coordinates } from "@dnd-kit/utilities";
import { countSelectedCards, SECTION_LIMITS, type CardSelection, type DeckCardSection, type DeckSection, type SelectedCard } from "../domain/deckBuilder";
import type { Card } from "../types/Card";
import { getCardImagePath } from "../services/cardImageService";
import type { CardViewMode } from "./CardViewToggle";
import ArchiveIcon from "./ArchiveIcon";
import CardDisplay from "./CardDisplay";
import { getCollectionCardDrag, getDeckCardDrag, getDeckDrop, getDeckSlotIndex, type DeckCardDrag, type DeckDropTarget } from "./deckCollectionDrag";
import styles from "./SortableDeckSection.module.scss";

interface Props {
  section: DeckSection;
  title: string;
  selection: CardSelection;
  viewMode: CardViewMode;
  overview?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  acceptsCollectionDrop?: boolean;
  onBrowse: () => void;
  onOpenCard: (card: Card) => void;
  onAddCard: (card: Card) => void;
  onRemoveCard: (card: Card) => void;
  canAdd: (card: Card) => boolean;
  moveDestinations: (from: DeckCardSection, card: Card) => DeckCardSection[];
}

type TileProps = Pick<Props, "title" | "viewMode" | "onOpenCard" | "onAddCard" | "onRemoveCard" | "canAdd" | "disabled" | "readOnly"> & {
  item: SelectedCard;
  draggableId: string;
  drag?: DeckCardDrag;
};

const sortingTransition = { duration: 240, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" };
const insertionAnimationId = "deck-card-insertion";

function SortableCard({ item, draggableId, drag, ...props }: TileProps) {
  const copiesLabel = `${item.qty} ${item.qty === 1 ? "copy" : "copies"}`;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: draggableId,
    disabled: !drag || props.disabled,
    data: { deckCard: drag },
  });

  return <article
    ref={setNodeRef}
    className={`${styles.tile} ${props.viewMode === "grid" ? styles.card : styles.row} ${isDragging ? styles.placeholder : ""}`}
    onDragStartCapture={event => event.preventDefault()}
  >
    <div className={styles.content}>
      {props.viewMode === "grid"
        ? <div className={styles.art} {...(drag && !props.disabled ? listeners : {})} onKeyDown={undefined} data-sortable={Boolean(drag && !props.disabled) || undefined}>
          <CardDisplay card={item.card} onClick={props.onOpenCard} />
        </div>
        : <img className={styles.rowArt} src={getCardImagePath(item.card, "thumb")} alt="" loading="lazy" draggable={false} />}
      <span className={`${styles.cardBadge} ${props.readOnly ? styles.copyBadge : ""}`} aria-label={props.readOnly ? copiesLabel : undefined}>
        {props.readOnly ? `×${item.qty}` : item.card.cost || "—"}
      </span>
      <button type="button" className={styles.name} onClick={() => props.onOpenCard(item.card)} title={item.card.name}>{item.card.name}</button>
      {!props.readOnly && <div className={styles.actions}>
        <div className={styles.quantity}>
          <button type="button" disabled={props.disabled} aria-label={`Remove ${item.card.name} from ${props.title}`} onClick={() => props.onRemoveCard(item.card)}>−</button>
          <span aria-label={`${item.qty} copies`}>{item.qty}</span>
          <button type="button" aria-label={`Add ${item.card.name} to ${props.title}`} disabled={!props.canAdd(item.card)} onClick={() => props.onAddCard(item.card)}>+</button>
        </div>
        {drag && <button type="button" ref={setActivatorNodeRef} disabled={props.disabled} className={styles.handle} {...attributes} {...listeners}
          aria-label={`Reorder ${item.card.name}`} title="Drag to reorder or move between sections. You can also press Space and use the arrow keys.">
          <ArchiveIcon name="grip" size={16} />
        </button>}
      </div>}
    </div>
    {isDragging && <span className={styles.dropLabel}>Drop here</span>}
  </article>;
}

export function DeckDragPreview({ item, viewMode, insertion }: { item: SelectedCard; viewMode: CardViewMode; insertion?: boolean }) {
  return <div className={`${styles.tile} ${viewMode === "grid" ? styles.card : styles.row} ${insertion ? styles.placeholder : styles.overlay}`} aria-hidden="true">
    <div className={styles.content}>
      {viewMode === "grid"
        ? <div className={styles.art}><CardDisplay card={item.card} enableFlip={false} /></div>
        : <img className={styles.rowArt} src={getCardImagePath(item.card, "thumb")} alt="" draggable={false} />}
      <span className={styles.cardBadge}>{item.card.cost || "—"}</span>
      <span className={styles.name}>{item.card.name}</span>
      <div className={styles.actions}><span className={styles.previewQuantity}>× {item.qty}</span><ArchiveIcon name="grip" size={16} /></div>
    </div>
    {insertion && <span className={styles.dropLabel}>Drop here</span>}
  </div>;
}

export default function SortableDeckSection({ section, title, selection, viewMode, overview, readOnly, disabled, acceptsCollectionDrop, onBrowse, moveDestinations, ...tileProps }: Props) {
  const grid = useRef<HTMLDivElement>(null);
  const previousSlots = useRef<Map<string, Coordinates> | null>(null);
  const entries = Object.values(selection);
  const surface = overview ? "overview" : "deck-panel";
  const targetId = `${surface}:${section}`;
  const deckTarget: DeckDropTarget = {
    section,
    surface,
    acceptsCollection: acceptsCollectionDrop,
    insertionIndex: (pointer, card) => Math.max(0, Math.min(getDeckSlotIndex(grid.current, pointer), entries.length - Number(Boolean(selection[card.id])))),
  };
  const { setNodeRef } = useDroppable({
    id: targetId,
    disabled: readOnly || disabled || (section === "protagonist" && !acceptsCollectionDrop),
    data: { deckTarget },
  });
  const dnd = useDndContext();
  const collectionDrag = getCollectionCardDrag(dnd.active);
  const deckDrag = getDeckCardDrag(dnd.active);
  const isSource = deckDrag?.surface === surface && deckDrag.section === section;
  const movableCard = deckDrag?.surface === surface && section !== "protagonist" && deckDrag.destinations.includes(section)
    ? deckDrag.item.card : undefined;
  const browsedCard = acceptsCollectionDrop && collectionDrag?.destinations.includes(section) ? collectionDrag.card : undefined;
  const dropCard = readOnly || disabled ? undefined : movableCard ?? browsedCard;
  const dropIndex = dropCard ? getDeckDrop(dnd.collisions, targetId)?.insertionIndex : undefined;
  const previewCard = dropIndex !== undefined ? dropCard : undefined;
  const displayEntries = previewCard ? entries.filter(item => item.card.id !== previewCard.id && section !== "protagonist") : entries;
  if (previewCard) {
    const qty = (selection[previewCard.id]?.qty ?? 0) + (isSource ? 0 : 1);
    displayEntries.splice(dropIndex ?? displayEntries.length, 0, { card: previewCard, qty });
  }

  useLayoutEffect(() => {
    const before = previousSlots.current;
    if (!dropCard && !before) return;
    const after = new Map<string, Coordinates>();
    const shifts: { tile: HTMLElement; animation?: Animation; x: number; y: number }[] = [];
    const animate = before && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // The wrappers stay in their layout slots while the card faces slide between them.
    for (const slot of grid.current?.querySelectorAll<HTMLElement>(":scope > [data-deck-card-id]") ?? []) {
      const id = slot.dataset.deckCardId!;
      const position = { x: slot.offsetLeft, y: slot.offsetTop };
      after.set(id, position);
      const previous = before?.get(id);
      if (!animate || !previous || id === previewCard?.id) continue;
      let x = previous.x - position.x;
      let y = previous.y - position.y;
      if (x === 0 && y === 0) continue;

      const tile = slot.firstElementChild as HTMLElement;
      const animation = tile.getAnimations().find(item => item.id === insertionAnimationId);
      if (animation) {
        const currentRect = tile.getBoundingClientRect();
        const slotRect = slot.getBoundingClientRect();
        x += currentRect.left - slotRect.left;
        y += currentRect.top - slotRect.top;
      }
      shifts.push({ tile, animation, x, y });
    }

    for (const { tile, animation, x, y } of shifts) {
      animation?.cancel();
      tile.animate([{ translate: `${x}px ${y}px` }, { translate: "0px 0px" }], { ...sortingTransition, id: insertionAnimationId });
    }
    previousSlots.current = dropCard ? after : null;
  }, [dropCard, dropIndex, previewCard, selection, viewMode]);

  const total = countSelectedCards(selection);
  return <section ref={setNodeRef} className={`${styles.section} ${overview ? styles.overview : ""}`} aria-label={title} data-deck-drop-target={dropCard ? true : undefined} data-deck-drop-over={dropIndex !== undefined || undefined}>
    <div className={styles.heading}>
      <h4>{title}<span>{section === "sideboard" ? total : `${total} / ${SECTION_LIMITS[section]}`}</span></h4>
      {!readOnly && <button type="button" onClick={onBrowse} aria-label={`Browse ${title.toLowerCase()} cards`}><ArchiveIcon name="plus" size={15} /> Add cards</button>}
    </div>
    {displayEntries.length === 0
      ? (readOnly ? <p className={styles.emptySummary}>No cards</p>
        : <button type="button" className={styles.empty} onClick={onBrowse}><ArchiveIcon name="plus" size={17} />{section === "protagonist" ? "Choose your protagonist" : `Add ${title.toLowerCase()} cards`}</button>)
      : <div ref={grid} data-deck-slots="" className={viewMode === "grid" ? styles.grid : styles.list}>
        {displayEntries.map(item => {
          const preview = previewCard?.id === item.card.id;
          let drag: DeckCardDrag | undefined;
          if (!readOnly && section !== "protagonist") {
            const destinations = moveDestinations(section, item.card);
            if (entries.length > 1 || destinations.length > 1) drag = { item, section, destinations, surface, viewMode };
          }
          return <div key={item.card.id} data-deck-card-id={item.card.id} data-insertion-preview={preview || undefined}>
            {preview && !isSource ? <DeckDragPreview item={item} viewMode={viewMode} insertion />
              : <SortableCard item={item} title={title} viewMode={viewMode} draggableId={`${targetId}:card:${item.card.id}`}
                readOnly={readOnly} disabled={disabled} drag={drag} {...tileProps} />}
          </div>;
        })}
      </div>}
  </section>;
}
