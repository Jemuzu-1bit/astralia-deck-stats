import { createContext, useId } from "react";
import { useDroppable, type CollisionDetection } from "@dnd-kit/core";
import type { GameCard, GameTable, GameZone } from "../../services/gameConnection";
import { findSlottedCard } from "./model";

export type GameDrop = { zone: GameZone; slot?: number; position?: "top" | "bottom"; targetUid?: string; attachToCard?: boolean };
export type CardDragPreview = { uid: string; targetUid: string };
export type DraggedGameCard = { uid: string; image: string; surface: string };
export const DraggedCardContext = createContext<string | null>(null);

export function useGameDrop(target?: GameDrop) {
  const id = useId();
  const { setNodeRef } = useDroppable({ id, disabled: !target, data: { target } });
  return { ref: setNodeRef, "data-game-drop": target ? id : undefined };
}

// Hit-test the visible DOM, including clipped cards and nested drop targets.
export const gameDropCollision: CollisionDetection = ({ pointerCoordinates, collisionRect, droppableContainers }) => {
  const point = pointerCoordinates ?? { x: collisionRect.left + collisionRect.width / 2, y: collisionRect.top + collisionRect.height / 2 };
  let element = document.elementFromPoint(point.x, point.y)?.closest("[data-game-drop]");
  while (element) {
    const container = droppableContainers.find(({ id }) => id === element?.getAttribute("data-game-drop"));
    if (container) return [{ id: container.id }];
    element = element.parentElement?.closest("[data-game-drop]");
  }
  return [];
};

export function getSlotPreview(table: GameTable, uid: string, target?: GameDrop): CardDragPreview | null {
  if (!target?.targetUid || target.targetUid === uid) return null;
  const source = findSlottedCard(table, uid);
  if (!source || source.zone !== target.zone || source.slot !== target.slot) return null;
  const stack = source.zone === "battle" ? table.battle[source.slot ?? 0] : table.protagonist;
  if (!stack?.some((card) => card.uid === target.targetUid)) return null;
  return { uid, targetUid: target.targetUid };
}

export function previewSlot(items: GameCard[], preview?: CardDragPreview | null): GameCard[] {
  if (!preview) return items;
  const source = items.findIndex(({ uid }) => uid === preview.uid);
  const target = items.findIndex(({ uid }) => uid === preview.targetUid);
  if (source < 0 || target < 0 || source === target) return items;
  const ordered = [...items];
  if (source === 0 || target === 0) [ordered[source], ordered[target]] = [ordered[target], ordered[source]];
  else ordered.splice(target, 0, ...ordered.splice(source, 1));
  return ordered;
}
