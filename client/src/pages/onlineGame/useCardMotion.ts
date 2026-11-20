import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";

type CardRect = Pick<DOMRectReadOnly, "left" | "top" | "width" | "height">;
type CardPosition = { uid: string; surface: string; image: HTMLImageElement; rect: CardRect };
export type DropOrigin = Pick<CardPosition, "uid" | "surface" | "rect">;

const motionId = "game-card-move";

function cardPositions(root: HTMLElement): CardPosition[] {
  return [...root.querySelectorAll<HTMLElement>("[data-card-uid]")].flatMap((card) => {
    if (card.closest("[inert]")) return [];
    const image = card.querySelector("img");
    if (!image) return [];
    const rect = image.getBoundingClientRect();
    if (!rect.width || !rect.height) return [];
    return [{ uid: card.dataset.cardUid!, surface: card.closest<HTMLElement>("[data-card-surface]")?.dataset.cardSurface ?? "table", image, rect }];
  });
}

export function useCardMotion(rootRef: RefObject<HTMLDivElement | null>) {
  const before = useRef<CardPosition[] | null>(null);
  const dropOrigin = useRef<DropOrigin | null>(null);

  const captureCards = useCallback((origin?: DropOrigin) => {
    if (!rootRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    before.current = cardPositions(rootRef.current);
    if (origin) dropOrigin.current = origin;
  }, [rootRef]);

  useLayoutEffect(() => {
    const previous = before.current;
    const origin = dropOrigin.current;
    before.current = null;
    dropOrigin.current = null;
    if (!previous || !rootRef.current) return;

    const exact = new Map(previous.map((card) => [`${card.surface}:${card.uid}`, card]));
    const byUid = new Map(previous.map((card) => [card.uid, card]));
    const positions = cardPositions(rootRef.current);
    const originSurfaceVisible = origin && positions.some(({ uid, surface }) => uid === origin.uid && surface === origin.surface);
    const movements = positions.map((card) => {
      const old = origin?.uid === card.uid && (origin.surface === card.surface || !originSurfaceVisible)
        ? origin.rect : (exact.get(`${card.surface}:${card.uid}`) ?? byUid.get(card.uid))?.rect;
      const animation = card.image.getAnimations().find((item) => item.id === motionId);
      return { ...card, old, animation };
    });
    for (const { image, rect, old, animation } of movements) {
      if (!old || (old.left === rect.left && old.top === rect.top && old.width === rect.width && old.height === rect.height)) continue;
      animation?.cancel();
      const final = animation ? image.getBoundingClientRect() : rect;
      const movement = image.animate([
        { translate: `${old.left - final.left}px ${old.top - final.top}px`, scale: `${old.width / final.width} ${old.height / final.height}`, transformOrigin: "top left" },
        { translate: "0px 0px", scale: "1", transformOrigin: "top left" },
      ], { id: motionId, duration: 240, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
      image.dataset.gameCardMoving = "";
      const clearMoving = () => {
        if (!image.getAnimations().some((item) => item !== movement && item.id === motionId)) delete image.dataset.gameCardMoving;
      };
      void movement.finished.then(clearMoving, clearMoving);
    }
  });

  return captureCards;
}
