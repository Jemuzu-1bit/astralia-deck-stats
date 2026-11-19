import type { Active, Collision, CollisionDetection } from "@dnd-kit/core";
import type { Coordinates } from "@dnd-kit/utilities";
import type { DeckSection } from "../domain/deckBuilder";
import type { Card } from "../types/Card";

export interface CollectionCardDrag {
  card: Card;
  section: DeckSection;
}

export interface CollectionDropTarget {
  section: DeckSection;
  insertionIndex: (pointer: Coordinates) => number;
}

export function getCollectionCardDrag(active: Active | null): CollectionCardDrag | undefined {
  return active?.data.current?.collectionCard as CollectionCardDrag | undefined;
}

export function getCollectionDropIndex(collisions: Collision[] | null, targetId?: string): number | undefined {
  const hit = collisions?.[0];
  if (!hit || (targetId !== undefined && hit.id !== targetId)) return;
  return hit.data?.insertionIndex as number | undefined;
}

export const collectionCollisionDetection: CollisionDetection = ({ active, pointerCoordinates, droppableContainers }) => {
  const drag = getCollectionCardDrag(active);
  if (!drag || !pointerCoordinates) return [];

  const { x, y } = pointerCoordinates;
  // Hit-test the visible panel to exclude areas clipped by its scroll container.
  const element = document.elementFromPoint(x, y);
  for (const container of droppableContainers) {
    const target = container.data.current?.collectionTarget as CollectionDropTarget | undefined;
    if (target?.section === drag.section && container.node.current?.contains(element)) {
      return [{ id: container.id, data: { insertionIndex: target.insertionIndex(pointerCoordinates) } }];
    }
  }
  return [];
};

export function getDeckSlotIndex(grid: HTMLElement | null, { x, y }: Coordinates): number {
  if (!grid?.childElementCount) return 0;
  const bounds = grid.getBoundingClientRect();
  if (y < bounds.top) return 0;
  if (y > bounds.bottom) return grid.childElementCount - 1;

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
