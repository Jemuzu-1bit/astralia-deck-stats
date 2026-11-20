import { createContext, useId } from "react";
import { useDroppable, type CollisionDetection } from "@dnd-kit/core";
import type { GameCard, GameTable, GameZone } from "../../services/gameConnection";
import { findSlottedCard } from "./model";

type SlotPosition = "main" | "sub";
export type GameDrop = { zone: GameZone; slot?: number; position?: "top" | "bottom"; targetUid?: string; slotPosition?: SlotPosition };
export type CardDragPreview =
  | { kind: "reorder"; uid: string; targetUid: string }
  | { kind: "placement"; uid: string; zone: "battle" | "protagonist"; slot?: number; slotPosition: SlotPosition };
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
  if (!target || (target.zone !== "battle" && target.zone !== "protagonist")) return null;
  const stack = target.zone === "battle" ? table.battle[target.slot ?? -1] : table.protagonist;
  if (!stack?.length) return null;
  const source = findSlottedCard(table, uid);
  const sameSlot = source?.zone === target.zone && source.slot === target.slot;
  if (target.slotPosition) {
    if (sameSlot && target.slotPosition === "sub" && stack.length === 1) return null;
    return { kind: "placement", uid, zone: target.zone, slot: target.slot, slotPosition: target.slotPosition };
  }
  if (!sameSlot || !target.targetUid || target.targetUid === uid || !stack.some((card) => card.uid === target.targetUid)) return null;
  return { kind: "reorder", uid, targetUid: target.targetUid };
}

export function isSameSlotPreview(a: CardDragPreview | null, b: CardDragPreview | null): boolean {
  if (!a || !b) return a === b;
  if (a.uid !== b.uid) return false;
  if (a.kind === "reorder" && b.kind === "reorder") return a.targetUid === b.targetUid;
  return a.kind === "placement" && b.kind === "placement" && a.zone === b.zone && a.slot === b.slot && a.slotPosition === b.slotPosition;
}

export function previewSlot(items: GameCard[], preview?: CardDragPreview | null): GameCard[] {
  if (preview?.kind !== "reorder") return items;
  const source = items.findIndex(({ uid }) => uid === preview.uid);
  const target = items.findIndex(({ uid }) => uid === preview.targetUid);
  if (source < 0 || target < 0 || source === target) return items;
  const ordered = [...items];
  if (source === 0 || target === 0) [ordered[source], ordered[target]] = [ordered[target], ordered[source]];
  else ordered.splice(target, 0, ...ordered.splice(source, 1));
  return ordered;
}
