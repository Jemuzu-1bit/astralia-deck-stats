import { useState } from "react";
import {
  countCardIdentity,
  countSelectedCards,
  filterCards,
  SECTION_LIMITS,
  type CardSelection,
  type DeckSection,
  type SelectedCard,
} from "../domain/deckBuilder";
import { getCardIdentity } from "../data/cardDataReader";
import type { CardFiltersState } from "../hooks/useCardFilters";
import type { AugCard } from "../types/AugCard";
import type { Card } from "../types/Card";
import CardDisplay from "./CardDisplay";
import CardFilters from "./CardFilters";
import styles from "./DeckCreationModal.module.scss";

interface DeckBuilderSectionProps {
  section: DeckSection;
  title: string;
  editing: boolean;
  options: AugCard[];
  filters: CardFiltersState;
  protagonist: SelectedCard | null;
  selection: CardSelection;
  identityLimit: number;
  onToggleEdit: () => void;
  onAddCard: (card: Card) => void;
  onRemoveCard: (card: Card) => void;
  onOpenCard: (card: Card) => void;
  onMoveCard?: (cardId: string, targetId: string) => void;
}

export default function DeckBuilderSection({
  section,
  title,
  editing,
  options,
  filters,
  protagonist,
  selection,
  identityLimit,
  onToggleEdit,
  onAddCard,
  onRemoveCard,
  onOpenCard,
  onMoveCard,
}: DeckBuilderSectionProps) {
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const limit = SECTION_LIMITS[section];
  const total = section === "protagonist" ? (protagonist ? 1 : 0) : countSelectedCards(selection);
  const selectedItems = Object.values(selection);
  const displayOptions = filterCards(options, filters);

  const selectedContent = (() => {
    if (section === "protagonist") {
      return protagonist ? (
        <div className={styles.selectedProtagonist}>
          <div className={styles.cardWrapper}>
            <CardDisplay card={protagonist.card} onClick={onOpenCard} />
          </div>
        </div>
      ) : (
        <div className={styles.empty}>No protagonist selected</div>
      );
    }

    if (selectedItems.length === 0) {
      return <div className={styles.empty}>No cards selected</div>;
    }

    return (
      <div>
        {onMoveCard && selectedItems.length > 1 && (
          <p className={styles.sectionHint}>Drag cards to change their order.</p>
        )}
        <div className={styles.selectedGrid}>
          {selectedItems.map((item) => (
            <div
              key={item.card.id}
              className={`${styles.selectedItem} ${draggedCardId === item.card.id ? styles.draggedItem : ""} ${dropTargetId === item.card.id ? styles.dropTarget : ""}`}
              draggable={Boolean(onMoveCard && selectedItems.length > 1)}
              onDragStart={(event) => {
                if (!onMoveCard) return;
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", item.card.id);
                setDraggedCardId(item.card.id);
              }}
              onDragOver={(event) => {
                if (!onMoveCard || !draggedCardId || draggedCardId === item.card.id) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropTargetId(item.card.id);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setDropTargetId(null);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedCardId) onMoveCard?.(draggedCardId, item.card.id);
                setDraggedCardId(null);
                setDropTargetId(null);
              }}
              onDragEnd={() => {
                setDraggedCardId(null);
                setDropTargetId(null);
              }}
            >
              <div className={styles.cardWrapper}>
                <CardDisplay card={item.card} onClick={onOpenCard} />
                {section === "deck" && (
                  <div className={styles.qtyBadge}>{item.qty}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  })();

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3>
          {title}
          <span className={styles.sectionCount}>{total}/{limit}</span>
        </h3>
        <button className={styles.editButton} onClick={onToggleEdit}>
          {editing ? "Done" : "Edit"}
        </button>
      </div>

      <div className={styles.sectionBody}>
        {editing ? (
          <>
            <CardFilters
              options={options}
              {...filters}
              hideTypeFilter={section === "protagonist"}
            />
            <div className={styles.editGrid}>
              {displayOptions.map((card) => {
                const currentQty =
                  section === "protagonist"
                    ? protagonist &&
                      getCardIdentity(protagonist.card) === getCardIdentity(card)
                      ? 1
                      : 0
                    : selection[card.id]?.qty ?? 0;
                const identityTotal =
                  section === "protagonist"
                    ? currentQty
                    : countCardIdentity(selection, card);
                const disableAdd =
                  identityTotal >= identityLimit ||
                  (section !== "protagonist" && total >= limit);

                return (
                  <div key={card.id} className={styles.editRow}>
                    <div className={styles.cardWrapper}>
                      <CardDisplay card={card} onClick={onOpenCard} />
                    </div>
                    <div className={styles.controls}>
                      <button
                        onClick={() => onRemoveCard(card)}
                        disabled={currentQty <= 0}
                      >
                        -
                      </button>
                      <span className={styles.qty}>{currentQty}</span>
                      <button
                        onClick={() => onAddCard(card)}
                        disabled={disableAdd}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          selectedContent
        )}
      </div>
    </section>
  );
}
