import { useEffect, useRef, useState, type HTMLAttributes } from "react";

const MIN_DECK_WIDTH = 300;
const MIN_COLLECTION_WIDTH = 360;
const DIVIDER_WIDTH = 10;

export function useDeckPanelResize(enabled: boolean) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const drag = useRef<{ pointerId: number; offset: number } | null>(null);
  const [deckWidth, setDeckWidth] = useState<number | null>(null);
  const [resizing, setResizing] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 360, max: 360 });

  useEffect(() => {
    const body = bodyRef.current;
    const panel = panelRef.current;
    if (!enabled || !body || !panel) return;

    const measure = () => {
      const max = Math.max(MIN_DECK_WIDTH, body.clientWidth - MIN_COLLECTION_WIDTH - DIVIDER_WIDTH);
      const width = Math.min(max, Math.max(MIN_DECK_WIDTH, Math.round(panel.getBoundingClientRect().width)));
      setDimensions(current => current.width === width && current.max === max ? current : { width, max });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [enabled]);

  const resize = (width: number) => {
    const body = bodyRef.current;
    if (!body) return;
    const max = Math.max(MIN_DECK_WIDTH, body.clientWidth - MIN_COLLECTION_WIDTH - DIVIDER_WIDTH);
    setDeckWidth(Math.min(max, Math.max(MIN_DECK_WIDTH, Math.round(width))));
  };

  const stopResizing = () => {
    drag.current = null;
    setResizing(false);
  };

  const separatorProps: HTMLAttributes<HTMLDivElement> = {
    role: "separator",
    tabIndex: 0,
    "aria-label": "Resize deck panel",
    "aria-orientation": "vertical",
    "aria-controls": "builder-deck-panel",
    "aria-valuemin": MIN_DECK_WIDTH,
    "aria-valuemax": dimensions.max,
    "aria-valuenow": dimensions.width,
    "aria-valuetext": `${dimensions.width} pixels wide`,
    title: "Drag to resize the deck panel. Use Left/Right keys, or double-click to reset.",
    onPointerDown: event => {
      const body = bodyRef.current;
      const panel = panelRef.current;
      if (event.button !== 0 || !body || !panel) return;
      event.preventDefault();
      event.currentTarget.focus();
      drag.current = {
        pointerId: event.pointerId,
        offset: body.getBoundingClientRect().right - event.clientX - panel.getBoundingClientRect().width,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      setResizing(true);
    },
    onPointerMove: event => {
      const body = bodyRef.current;
      if (!body || drag.current?.pointerId !== event.pointerId) return;
      resize(body.getBoundingClientRect().right - event.clientX - drag.current.offset);
    },
    onPointerUp: event => {
      if (drag.current?.pointerId !== event.pointerId) return;
      stopResizing();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    onPointerCancel: stopResizing,
    onLostPointerCapture: stopResizing,
    onDoubleClick: () => setDeckWidth(null),
    onKeyDown: event => {
      const panel = panelRef.current;
      if (!panel) return;
      const step = event.shiftKey ? 60 : 20;
      switch (event.key) {
        case "ArrowLeft":
          resize(panel.getBoundingClientRect().width + step);
          break;
        case "ArrowRight":
          resize(panel.getBoundingClientRect().width - step);
          break;
        case "Home":
          resize(MIN_DECK_WIDTH);
          break;
        case "End":
          resize(dimensions.max);
          break;
        default:
          return;
      }
      event.preventDefault();
    },
  };

  return { bodyRef, panelRef, deckWidth, resizing, separatorProps };
}
