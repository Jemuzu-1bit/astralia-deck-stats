import { useEffect, useRef, useState } from "react";
import { featureMetadata } from "../config/features";
import styles from "./CustomCursor.module.scss";

type CursorVisualState = "idle" | "hover" | "click" | "busy" | "drag" | "move";
type CompanionId = "system" | "colored" | "astralia" | "chibi" | "pochita" | "cat" | "dog" | "sea-lion";

type Companion = {
  id: CompanionId;
  label: string;
  source?: string;
  sources?: Record<CursorVisualState, string>;
};

const CURSOR_STATE_PATH = "/cursors/astralia/state-";

const companions: Companion[] = [
  { id: "system", label: "Sistema" },
  { id: "colored", label: "Colorato" },
  {
    id: "astralia",
    label: "Pochitan1",
    sources: {
      idle: `${CURSOR_STATE_PATH}idle.webp`,
      hover: `${CURSOR_STATE_PATH}hover.webp`,
      click: `${CURSOR_STATE_PATH}click.webp`,
      busy: `${CURSOR_STATE_PATH}busy.webp`,
      drag: `${CURSOR_STATE_PATH}drag.webp`,
      move: `${CURSOR_STATE_PATH}move.webp`,
    },
  },
  { id: "chibi", label: "Chibi", source: "/cursors/astralia/chibi.webp" },
  {
    id: "pochita",
    label: "Pochita",
    sources: {
      idle: "/cursors/astralia/pochita-idle.gif",
      hover: "/cursors/astralia/pochita-hover.gif",
      click: "/cursors/astralia/pochita-click.gif",
      busy: "/cursors/astralia/pochita-busy.gif",
      drag: "/cursors/astralia/pochita-drag.gif",
      move: "/cursors/astralia/pochita-move.gif",
    },
  },
  {
    id: "cat",
    label: "Gatto",
    sources: {
      idle: "/cursors/animals/cat-idle.gif",
      hover: "/cursors/animals/cat-hover.gif",
      click: "/cursors/animals/cat-click.gif",
      busy: "/cursors/animals/cat-busy.gif",
      drag: "/cursors/animals/cat-drag.gif",
      move: "/cursors/animals/cat-move.gif",
    },
  },
  {
    id: "dog",
    label: "Cane",
    sources: {
      idle: "/cursors/animals/dog-idle.gif",
      hover: "/cursors/animals/dog-hover.gif",
      click: "/cursors/animals/dog-click.gif",
      busy: "/cursors/animals/dog-busy.gif",
      drag: "/cursors/animals/dog-drag.gif",
      move: "/cursors/animals/dog-move.gif",
    },
  },
  {
    id: "sea-lion",
    label: "Leone marino",
    sources: {
      idle: "/cursors/astralia/sea-lion-closed.webp",
      hover: "/cursors/astralia/sea-lion-closed.webp",
      click: "/cursors/astralia/sea-lion-open.webp",
      busy: "/cursors/astralia/sea-lion-closed.webp",
      drag: "/cursors/astralia/sea-lion-open.webp",
      move: "/cursors/astralia/sea-lion-closed.webp",
    },
  },
];

const interactiveSelector = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "[role='button']",
  "[role='link']",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
  "[data-cursor='hover']",
].join(",");

const cursorStates: CursorVisualState[] = ["idle", "hover", "click", "busy", "drag", "move"];

function isCursorState(value: string | undefined): value is CursorVisualState {
  return cursorStates.includes(value as CursorVisualState);
}

function storedCompanion(): CompanionId {
  const stored = localStorage.getItem("astralia.cursorCompanion.v2") as CompanionId | null;
  return companions.some(({ id }) => id === stored) ? stored! : "chibi";
}

export default function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [visualState, setVisualState] = useState<CursorVisualState>("idle");
  const [companionId, setCompanionId] = useState<CompanionId>(storedCompanion);
  const cursorRef = useRef<HTMLDivElement>(null);
  const visualStateRef = useRef<CursorVisualState>("idle");
  const targetPosition = useRef({ x: -100, y: -100 });
  const frameRequest = useRef<number | null>(null);
  const idleTimer = useRef<number | null>(null);
  const pressed = useRef(false);
  const dragged = useRef(false);
  const pressOrigin = useRef({ x: 0, y: 0 });
  const currentTarget = useRef<EventTarget | null>(null);
  const forcedBusy = useRef(false);

  const companion = companions.find(({ id }) => id === companionId) ?? companions[0];
  const companionSource = companion.sources?.[visualState] ?? companion.source;
  const cursorEnabled = enabled && companionId !== "system";

  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine) and (hover: hover)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateAvailability = () => setEnabled(finePointer.matches && !reducedMotion.matches);

    updateAvailability();
    finePointer.addEventListener("change", updateAvailability);
    reducedMotion.addEventListener("change", updateAvailability);

    return () => {
      finePointer.removeEventListener("change", updateAvailability);
      reducedMotion.removeEventListener("change", updateAvailability);
    };
  }, []);

  useEffect(() => {
    if (!cursorEnabled) {
      document.documentElement.classList.remove("custom-cursor-active");
      return;
    }

    const root = document.documentElement;
    root.classList.add("custom-cursor-active");

    const commitState = (nextState: CursorVisualState) => {
      if (visualStateRef.current === nextState) return;
      visualStateRef.current = nextState;
      setVisualState(nextState);
    };

    const stateForTarget = (target: EventTarget | null): CursorVisualState => {
      if (forcedBusy.current || root.dataset.cursorBusy === "true") return "busy";
      if (!(target instanceof Element)) return "idle";

      const override = target.closest<HTMLElement>("[data-cursor]")?.dataset.cursor;
      if (isCursorState(override)) return override;
      if (target.closest("[aria-busy='true']")) return "busy";
      return target.closest(interactiveSelector) ? "hover" : "idle";
    };

    const showCursor = () => {
      root.classList.add("custom-cursor-active");
      if (cursorRef.current) cursorRef.current.style.opacity = "1";
    };

    const schedulePosition = () => {
      if (frameRequest.current !== null) return;
      frameRequest.current = window.requestAnimationFrame(() => {
        frameRequest.current = null;
        const cursor = cursorRef.current;
        if (!cursor) return;
        const { x, y } = targetPosition.current;
        cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        cursor.dataset.horizontal = x > window.innerWidth - 126 ? "left" : "right";
        cursor.dataset.vertical = y > window.innerHeight - 112 ? "top" : "bottom";
      });
    };

    const scheduleIdle = () => {
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => {
        if (!pressed.current) commitState(stateForTarget(currentTarget.current));
      }, 180);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      currentTarget.current = event.target;
      targetPosition.current = { x: event.clientX, y: event.clientY };
      showCursor();
      schedulePosition();

      if (pressed.current) {
        const distance = Math.hypot(
          event.clientX - pressOrigin.current.x,
          event.clientY - pressOrigin.current.y,
        );
        if (distance > 5) dragged.current = true;
        commitState(dragged.current ? "drag" : "click");
      } else {
        const targetState = stateForTarget(event.target);
        commitState(targetState === "idle" ? "move" : targetState);
        scheduleIdle();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      pressed.current = true;
      dragged.current = false;
      pressOrigin.current = { x: event.clientX, y: event.clientY };
      commitState("click");
    };

    const onPointerUp = (event: PointerEvent) => {
      pressed.current = false;
      dragged.current = false;
      commitState(stateForTarget(event.target));
      scheduleIdle();
    };

    const onPointerLeave = () => {
      if (cursorRef.current) cursorRef.current.style.opacity = "0";
    };

    const onKeyboardNavigation = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      root.classList.remove("custom-cursor-active");
      if (cursorRef.current) cursorRef.current.style.opacity = "0";
    };

    const onBusyChange = (event: Event) => {
      forcedBusy.current = Boolean((event as CustomEvent<boolean>).detail);
      commitState(forcedBusy.current ? "busy" : stateForTarget(currentTarget.current));
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    document.addEventListener("mouseleave", onPointerLeave);
    window.addEventListener("keydown", onKeyboardNavigation);
    window.addEventListener("astralia:cursor-busy", onBusyChange);

    return () => {
      root.classList.remove("custom-cursor-active");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("mouseleave", onPointerLeave);
      window.removeEventListener("keydown", onKeyboardNavigation);
      window.removeEventListener("astralia:cursor-busy", onBusyChange);
      if (frameRequest.current !== null) window.cancelAnimationFrame(frameRequest.current);
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    };
  }, [cursorEnabled]);

  const selectCompanion = (nextId: CompanionId) => {
    setCompanionId(nextId);
    localStorage.setItem("astralia.cursorCompanion.v2", nextId);
  };

  return (
    <>
      {cursorEnabled && (
        <div
          ref={cursorRef}
          className={styles.cursorLayer}
          data-state={visualState}
          data-companion={companionId}
          data-feature-classification={featureMetadata.customCursor.classification}
          data-feature-required={featureMetadata.customCursor.required}
          aria-hidden="true"
        >
          <span className={styles.pointer} />
          <span className={styles.sparkle} />
          {companionSource && companionId === "astralia" && (
            <span className={styles.spriteViewport}>
              <img
                key={visualState}
                className={styles.spriteStrip}
                src={companionSource}
                alt=""
                draggable={false}
              />
            </span>
          )}
          {companionSource && companionId !== "astralia" && (
            <img className={styles.companion} src={companionSource} alt="" draggable={false} />
          )}
        </div>
      )}

      <label
        className={styles.picker}
        data-feature-classification={featureMetadata.customCursor.classification}
        data-feature-required={featureMetadata.customCursor.required}
      >
        <span>Cursor</span>
        <select
          value={companionId}
          onChange={(event) => selectCompanion(event.target.value as CompanionId)}
          aria-label="Scegli il compagno del cursore"
        >
          {companions.map(({ id, label }) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </label>
    </>
  );
}
