import { useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
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
import { CSS } from "@dnd-kit/utilities";
import { countSelectedCards, SECTION_LIMITS, type CardSelection, type DeckSection, type SelectedCard } from "../domain/deckBuilder";
import type { Card } from "../types/Card";
import { getCardImagePath } from "../services/cardImageService";
import type { CardViewMode } from "./CardViewToggle";
import ArchiveIcon from "./ArchiveIcon";
import CardDisplay from "./CardDisplay";
import styles from "./SortableDeckSection.module.scss";

interface Props {
  section: DeckSection;
  title: string;
  selection: CardSelection;
  viewMode: CardViewMode;
  overview?: boolean;
  disabled?: boolean;
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

function SortableCard({ item, sortable, ...props }: TileProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.card.id,
    disabled: !sortable,
    transition: { duration: 240, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
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

function DraggedCard({ item, viewMode }: { item: SelectedCard; viewMode: CardViewMode }) {
  return <div className={`${styles.tile} ${viewMode === "grid" ? styles.card : styles.row} ${styles.overlay}`} aria-hidden="true">
    <div className={styles.content}>
      {viewMode === "grid"
        ? <div className={styles.art}><CardDisplay card={item.card} enableFlip={false} /></div>
        : <img className={styles.rowArt} src={getCardImagePath(item.card, "thumb")} alt="" draggable={false} />}
      <span className={styles.cost}>{item.card.cost || "—"}</span>
      <span className={styles.name}>{item.card.name}</span>
      <div className={styles.actions}><span className={styles.previewQuantity}>× {item.qty}</span><ArchiveIcon name="grip" size={16} /></div>
    </div>
  </div>;
}

export default function SortableDeckSection({ section, title, selection, viewMode, overview, disabled, onBrowse, onMoveCard, onSortingChange, ...tileProps }: Props) {
  const [active, setActive] = useState<SelectedCard | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const entries = Object.values(selection);
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

  return <section className={`${styles.section} ${overview ? styles.overview : ""}`} aria-label={title}>
    <div className={styles.heading}>
      <h4>{title}<span>{total} / {SECTION_LIMITS[section]}</span></h4>
      <button type="button" onClick={onBrowse} aria-label={`Browse ${title.toLowerCase()} cards`}><ArchiveIcon name="plus" size={15} /> Add cards</button>
    </div>
    {entries.length === 0
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
            {entries.map(item => <SortableCard key={item.card.id} item={item} title={title} viewMode={viewMode} sortable={sortable} {...tileProps} />)}
          </div>
        </SortableContext>
        <DragOverlay zIndex={10050} adjustScale={false} style={{ pointerEvents: "none" }}
          dropAnimation={window.matchMedia("(prefers-reduced-motion: reduce)").matches ? null : { duration: 240, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
          {active ? <DraggedCard item={active} viewMode={viewMode} /> : null}
        </DragOverlay>
      </DndContext>}
  </section>;
}
