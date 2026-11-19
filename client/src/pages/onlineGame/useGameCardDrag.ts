import { KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent, type DragOverEvent, type DragStartEvent } from "@dnd-kit/core";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { gameConnection, type GameTable } from "../../services/gameConnection";
import { getSlotPreview, type CardDragPreview, type DraggedGameCard, type GameDrop } from "./cardDrag";
import { findSlottedCard, tableCards } from "./model";
import { useCardMotion, type DropOrigin } from "./useCardMotion";

export function useGameCardDrag(rootRef: RefObject<HTMLDivElement | null>, table: GameTable, enabled: boolean, onPickup: () => void) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const overlayRef = useRef<HTMLImageElement>(null);
  const source = useRef<DraggedGameCard | null>(null);
  const pending = useRef<{ timer: number; origin?: DropOrigin } | null>(null);
  const [active, setActive] = useState<DraggedGameCard | null>(null);
  const [preview, setPreview] = useState<CardDragPreview | null>(null);
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const captureCards = useCardMotion(rootRef);

  const clearPending = useCallback(() => {
    if (!pending.current) return;
    window.clearTimeout(pending.current.timer);
    pending.current = null;
    setPendingUid(null);
    setPreview(null);
  }, []);

  const captureUpdate = useCallback(() => {
    captureCards(pending.current?.origin);
    clearPending();
  }, [captureCards, clearPending]);

  useEffect(() => () => { window.clearTimeout(pending.current?.timer); }, []);

  const onDragStart = ({ active: item }: DragStartEvent) => {
    const card = item.data.current as Pick<DraggedGameCard, "uid" | "image"> | undefined;
    if (!enabled || !card) return;
    if (pending.current) captureUpdate();
    const node = [...rootRef.current?.querySelectorAll<HTMLElement>("[data-game-drag-id]") ?? []]
      .find((element) => element.dataset.gameDragId === item.id);
    const surface = node?.closest<HTMLElement>("[data-card-surface]")?.dataset.cardSurface ?? "table";
    source.current = { ...card, surface };
    setActive(source.current);
    onPickup();
  };

  const onDragOver = ({ over }: DragOverEvent) => {
    if (!source.current) return;
    const next = getSlotPreview(table, source.current.uid, over?.data.current?.target as GameDrop | undefined);
    if (next?.targetUid === preview?.targetUid) return;
    captureCards();
    setPreview(next);
  };

  const finishDrag = (target?: GameDrop) => {
    const card = source.current;
    if (!card) return;
    const rect = overlayRef.current?.getBoundingClientRect();
    const origin = rect ? { uid: card.uid, surface: card.surface, rect } : undefined;
    const slotted = findSlottedCard(table, card.uid);
    const sameSlot = slotted && slotted.zone === target?.zone && slotted.slot === target.slot;
    const slotPreview = getSlotPreview(table, card.uid, target);
    const entry = enabled && tableCards(table).find(({ uid }) => uid === card.uid);
    const canMove = entry && target && !sameSlot && !(target.attachToCard && entry.isProtagonist);
    if (entry && slotPreview) {
      captureCards(origin);
      setPreview(slotPreview);
      gameConnection.swapSlotCard(card.uid, slotPreview.targetUid);
    } else if (canMove) {
      setPreview(null);
      setPendingUid(card.uid);
      if (target.attachToCard && target.targetUid && (!slotted || slotted.index === 0)) gameConnection.attachCard(card.uid, target.targetUid);
      else gameConnection.moveCard(card.uid, target.zone, { slot: target.slot, position: target.position });
    } else {
      captureCards(origin);
      setPreview(null);
    }
    if ((entry && slotPreview) || canMove) {
      pending.current = { timer: window.setTimeout(captureUpdate, 600), origin: canMove ? origin : undefined };
    }
    source.current = null;
    setActive(null);
  };

  return {
    active, preview, overlayRef, captureUpdate, draggedUid: active?.uid ?? pendingUid,
    sensors, onDragStart, onDragOver,
    onDragEnd: ({ over }: DragEndEvent) => finishDrag(over?.data.current?.target as GameDrop | undefined),
    onDragCancel: () => finishDrag(),
  };
}
