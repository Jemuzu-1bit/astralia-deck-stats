import { useLayoutEffect, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDndContext,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
} from "@dnd-kit/core";
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS, type Coordinates } from "@dnd-kit/utilities";
import { countSelectedCards, SECTION_LIMITS, type CardSelection, type DeckSection, type SelectedCard } from "../domain/deckBuilder";
import type { Card } from "../types/Card";
import { getCardImagePath } from "../services/cardImageService";
import type { CardViewMode } from "./CardViewToggle";
import ArchiveIcon from "./ArchiveIcon";
import CardDisplay from "./CardDisplay";
import { getCollectionCardDrag, getCollectionDropIndex, getDeckSlotIndex, type CollectionDropTarget } from "./deckCollectionDrag";
import styles from "./SortableDeckSection.module.scss";

interface Props {
  section: DeckSection;
  title: string;
  selection: CardSelection;
  viewMode: CardViewMode;
  overview?: boolean;
  disabled?: boolean;
  acceptsCollectionDrop?: boolean;
  onBrowse: () => void;
  onOpenCard: (card: Card) => void;
  onAddCard: (card: Card) => void;
  onRemoveCard: (card: Card) => void;
  canAdd: (card: Card) => boolean;
  onMoveCard?: (cardId: string, targetId: string) => void;
  onSortingChange: (sorting: boolean) => void;
}

type TileProps = Pick<Props, "title" | "viewMode" | "onOpenCard" | "onAddCard" | "onRemoveCard" | "canAdd"> & {
  item: SelectedCard;
  sortable: boolean;
};

const sortingTransition = { duration: 240, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" };
const insertionAnimationId = "deck-card-insertion";

function SortableCard({ item, sortable, ...props }: TileProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.card.id,
    disabled: !sortable,
    transition: sortingTransition,
  });

  return <article
    ref={setNodeRef}
    className={`${styles.tile} ${props.viewMode === "grid" ? styles.card : styles.row} ${isDragging ? styles.placeholder : ""}`}
    style={{ transform: CSS.Transform.toString(transform), transition }}
    onDragStartCapture={event => event.preventDefault()}
  >
    <div className={styles.content}>
      {props.viewMode === "grid"
        ? <div className={styles.art} {...(sortable ? listeners : {})} onKeyDown={undefined} data-sortable={sortable || undefined}>
          <CardDisplay card={item.card} onClick={props.onOpenCard} />
        </div>
        : <img className={styles.rowArt} src={getCardImagePath(item.card, "thumb")} alt="" loading="lazy" draggable={false} />}
      <span className={styles.cost}>{item.card.cost || "—"}</span>
      <button type="button" className={styles.name} onClick={() => props.onOpenCard(item.card)} title={item.card.name}>{item.card.name}</button>
      <div className={styles.actions}>
        <div className={styles.quantity}>
          <button type="button" aria-label={`Remove ${item.card.name} from ${props.title}`} onClick={() => props.onRemoveCard(item.card)}>−</button>
          <span aria-label={`${item.qty} copies`}>{item.qty}</span>
          <button type="button" aria-label={`Add ${item.card.name} to ${props.title}`} disabled={!props.canAdd(item.card)} onClick={() => props.onAddCard(item.card)}>+</button>
        </div>
        {sortable && <button type="button" ref={setActivatorNodeRef} className={styles.handle} {...attributes} {...listeners}
          aria-label={`Reorder ${item.card.name}`} title="Drag to reorder, or press Space and use the arrow keys">
          <ArchiveIcon name="grip" size={16} />
        </button>}
      </div>
    </div>
    {isDragging && <span className={styles.dropLabel}>Drop here</span>}
  </article>;
}

function DraggedCard({ item, viewMode, insertion }: { item: SelectedCard; viewMode: CardViewMode; insertion?: boolean }) {
  return <div className={`${styles.tile} ${viewMode === "grid" ? styles.card : styles.row} ${insertion ? styles.placeholder : styles.overlay}`} aria-hidden="true">
    <div className={styles.content}>
      {viewMode === "grid"
        ? <div className={styles.art}><CardDisplay card={item.card} enableFlip={false} /></div>
        : <img className={styles.rowArt} src={getCardImagePath(item.card, "thumb")} alt="" draggable={false} />}
      <span className={styles.cost}>{item.card.cost || "—"}</span>
      <span className={styles.name}>{item.card.name}</span>
      <div className={styles.actions}><span className={styles.previewQuantity}>× {item.qty}</span><ArchiveIcon name="grip" size={16} /></div>
    </div>
    {insertion && <span className={styles.dropLabel}>Drop here</span>}
  </div>;
}

export default function SortableDeckSection({ section, title, selection, viewMode, overview, disabled, acceptsCollectionDrop, onBrowse, onMoveCard, onSortingChange, ...tileProps }: Props) {
  const [active, setActive] = useState<SelectedCard | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const previousSlots = useRef<Map<string, Coordinates> | null>(null);
  const entries = Object.values(selection);
  const targetId = `${overview ? "overview" : "deck-panel"}:${section}`;
  const collectionTarget: CollectionDropTarget = { section, insertionIndex: pointer => getDeckSlotIndex(grid.current, pointer) };
  const { node: sectionNode, setNodeRef } = useDroppable({
    id: targetId,
    disabled: !acceptsCollectionDrop || disabled,
    data: { collectionTarget },
  });
  const collection = useDndContext();
  const dragged = getCollectionCardDrag(collection.active);
  const dropCard = acceptsCollectionDrop && !disabled && dragged?.section === section ? dragged.card : undefined;
  const dropIndex = dropCard ? getCollectionDropIndex(collection.collisions, targetId) : undefined;
  const hasSlot = section === "protagonist" ? entries.length > 0 : Boolean(dropCard && selection[dropCard.id]);
  const previewCard = dropCard && (dropIndex !== undefined || !hasSlot) ? dropCard : undefined;
  const displayEntries = previewCard ? entries.filter(item => item.card.id !== previewCard.id && section !== "protagonist") : entries;
  if (previewCard) {
    displayEntries.splice(dropIndex ?? displayEntries.length, 0, { card: previewCard, qty: (selection[previewCard.id]?.qty ?? 0) + 1 });
  }

  useLayoutEffect(() => {
    if (dropCard) sectionNode.current?.scrollIntoView({ block: "nearest" });
  }, [dropCard, sectionNode]);

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
  const sortable = Boolean(onMoveCard && entries.length > 1 && !disabled);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const collisionDetection: CollisionDetection = args => {
    if (args.pointerCoordinates && grid.current) {
      const { x, y } = args.pointerCoordinates;
      const rect = grid.current.getBoundingClientRect();
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return [];
    }
    return closestCenter(args);
  };
  const finishDrag = () => { setActive(null); onSortingChange(false); };
  const cardName = (id: string | number) => selection[id]?.card.name ?? "Card";

  return <section ref={acceptsCollectionDrop ? setNodeRef : undefined} className={`${styles.section} ${overview ? styles.overview : ""}`} aria-label={title} data-collection-target={dropCard ? true : undefined} data-collection-over={dropIndex !== undefined || undefined}>
    <div className={styles.heading}>
      <h4>{title}<span>{total} / {SECTION_LIMITS[section]}</span></h4>
      <button type="button" onClick={onBrowse} aria-label={`Browse ${title.toLowerCase()} cards`}><ArchiveIcon name="plus" size={15} /> Add cards</button>
    </div>
    {displayEntries.length === 0
      ? <button type="button" className={styles.empty} onClick={onBrowse}><ArchiveIcon name="plus" size={17} />{section === "protagonist" ? "Choose your protagonist" : `Add ${title.toLowerCase()} cards`}</button>
      : <DndContext sensors={sensors} collisionDetection={collisionDetection}
        onDragStart={({ active }) => { setActive(selection[active.id] ?? null); onSortingChange(true); }}
        onDragCancel={finishDrag}
        onDragEnd={({ active, over }) => {
          if (over && active.id !== over.id) onMoveCard?.(String(active.id), String(over.id));
          finishDrag();
        }}
        accessibility={{
          screenReaderInstructions: { draggable: "Press Space to pick up a card, use the arrow keys to change its position, and press Space to drop it. Press Escape to cancel." },
          announcements: {
            onDragStart: ({ active }) => `Picked up ${cardName(active.id)} in ${title}.`,
            onDragOver: ({ active, over }) => over ? `${cardName(active.id)} will be placed at position ${entries.findIndex(item => item.card.id === over.id) + 1} of ${entries.length}.` : "Outside this section. Drop to cancel.",
            onDragEnd: ({ active, over }) => over ? `${cardName(active.id)} placed at position ${entries.findIndex(item => item.card.id === over.id) + 1}.` : "Move cancelled. Card order unchanged.",
            onDragCancel: () => "Move cancelled. Card order unchanged.",
          },
        }}
      >
        <SortableContext items={entries.map(item => item.card.id)} strategy={viewMode === "grid" ? rectSortingStrategy : verticalListSortingStrategy}>
          <div ref={grid} className={viewMode === "grid" ? styles.grid : styles.list}>
            {displayEntries.map(item => <div key={item.card.id} data-deck-card-id={item.card.id} data-insertion-preview={previewCard?.id === item.card.id || undefined}>
              {previewCard?.id === item.card.id
                ? <DraggedCard item={item} viewMode={viewMode} insertion />
                : <SortableCard item={item} title={title} viewMode={viewMode} sortable={sortable} {...tileProps} />}
            </div>)}
          </div>
        </SortableContext>
        <DragOverlay zIndex={10050} adjustScale={false} style={{ pointerEvents: "none" }}
          dropAnimation={window.matchMedia("(prefers-reduced-motion: reduce)").matches ? null : sortingTransition}>
          {active ? <DraggedCard item={active} viewMode={viewMode} /> : null}
        </DragOverlay>
      </DndContext>}
  </section>;
}
