import type { Active, Collision, CollisionDetection, KeyboardCoordinateGetter } from "@dnd-kit/core";
import type { Coordinates } from "@dnd-kit/utilities";
import type { DeckCardSection, DeckSection, SelectedCard } from "../domain/deckBuilder";
import type { Card } from "../types/Card";
import type { CardViewMode } from "./CardViewToggle";

export interface CollectionCardDrag {
  card: Card;
  destinations: DeckSection[];
}

export type DeckDragSurface = "overview" | "deck-panel";

export interface DeckCardDrag {
  item: SelectedCard;
  section: DeckCardSection;
  destinations: DeckCardSection[];
  surface: DeckDragSurface;
  viewMode: CardViewMode;
}

export interface DeckDropTarget {
  section: DeckSection;
  surface?: DeckDragSurface;
  acceptsCollection?: boolean;
  insertionIndex?: (pointer: Coordinates, card: Card) => number;
}

interface DeckDrop {
  section: DeckSection;
  insertionIndex?: number;
}

export function getCollectionCardDrag(active: Active | null): CollectionCardDrag | undefined {
  return active?.data.current?.collectionCard as CollectionCardDrag | undefined;
}

export function getDeckCardDrag(active: Active | null): DeckCardDrag | undefined {
  return active?.data.current?.deckCard as DeckCardDrag | undefined;
}

export function getDeckDrop(collisions: Collision[] | null, targetId?: string): DeckDrop | undefined {
  const hit = collisions?.[0];
  if (!hit || (targetId !== undefined && hit.id !== targetId)) return;
  return hit.data?.deckDrop as DeckDrop | undefined;
}

function acceptsDeckCard(target: DeckDropTarget, drag: DeckCardDrag): boolean {
  return target.surface === drag.surface && target.section !== "protagonist" && drag.destinations.includes(target.section);
}

function rectCenter(rect: Pick<DOMRect, "left" | "top" | "width" | "height">): Coordinates {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export const deckCollisionDetection: CollisionDetection = ({ active, collisionRect, pointerCoordinates, droppableContainers }) => {
  const collectionCard = getCollectionCardDrag(active);
  const deckCard = getDeckCardDrag(active);
  const card = collectionCard?.card ?? deckCard?.item.card;
  if (!card) return [];

  const pointer = pointerCoordinates ?? rectCenter(collisionRect);
  // Hit-test the visible panel to exclude areas clipped by its scroll container.
  const element = document.elementFromPoint(pointer.x, pointer.y);
  for (const container of droppableContainers) {
    const target = container.data.current?.deckTarget as DeckDropTarget | undefined;
    if (!target || !container.node.current?.contains(element)) continue;
    const allowed = deckCard ? acceptsDeckCard(target, deckCard)
      : target.acceptsCollection && collectionCard?.destinations.includes(target.section);
    if (!allowed) continue;
    const deckDrop: DeckDrop = { section: target.section, insertionIndex: target.insertionIndex?.(pointer, card) };
    return [{ id: container.id, data: { deckDrop } }];
  }
  return [];
};

const arrowDirections: Record<string, Coordinates> = {
  ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
};

export const deckKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  const direction = arrowDirections[event.code];
  const drag = getDeckCardDrag(context.active);
  if (!direction || !drag || !context.collisionRect) return;
  const center = rectCenter(context.collisionRect);
  let closest: Coordinates | undefined;
  let shortest = Infinity;

  for (const container of context.droppableContainers.getEnabled()) {
    const target = container.data.current?.deckTarget as DeckDropTarget | undefined;
    const node = container.node.current;
    if (!target || !node || !acceptsDeckCard(target, drag)) continue;
    const slots = node.querySelector("[data-deck-slots]")?.children;
    for (const slot of slots?.length ? Array.from(slots) : [node]) {
      const rect = slot.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const candidate = rectCenter(rect);
      const delta = { x: candidate.x - center.x, y: candidate.y - center.y };
      const distance = delta.x ** 2 + delta.y ** 2;
      if (delta.x * direction.x + delta.y * direction.y > 2 && distance < shortest) {
        closest = delta;
        shortest = distance;
      }
    }
  }
  return closest && { x: currentCoordinates.x + closest.x, y: currentCoordinates.y + closest.y };
};

export function getDeckSlotIndex(grid: HTMLElement | null, { x, y }: Coordinates): number {
  if (!grid?.childElementCount) return 0;
  const bounds = grid.getBoundingClientRect();
  if (y < bounds.top) return 0;
  if (y > bounds.bottom) return grid.childElementCount;

  let nearestIndex = 0;
  let nearestRow = Infinity;
  let nearestColumn = Infinity;
  Array.from(grid.children).forEach((slot, index) => {
    const rect = slot.getBoundingClientRect();
    const rowDistance = Math.max(rect.top - y, y - rect.bottom, 0);
    const columnDistance = Math.abs(x - (rect.left + rect.width / 2));
    if (rowDistance < nearestRow || (rowDistance === nearestRow && columnDistance < nearestColumn)) {
      nearestIndex = index;
      nearestRow = rowDistance;
      nearestColumn = columnDistance;
    }
  });
  return nearestIndex;
}
