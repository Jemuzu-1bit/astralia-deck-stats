export type CursorVisualState = "idle" | "hover" | "click" | "busy" | "drag" | "move";
export type CompanionId = "system" | "colored" | "astralia" | "chibi" | "pochita" | "cat" | "dog" | "sea-lion";

type Companion = {
  id: CompanionId;
  label: string;
  source?: string;
  sources?: Record<CursorVisualState, string>;
};

const CURSOR_STATE_PATH = "/cursors/astralia/state-";
export const CURSOR_CHANGE_EVENT = "astralia:cursor-companion-change";

export const companions: Companion[] = [
  { id: "system", label: "System" },
  { id: "colored", label: "Colored" },
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
    label: "Cat",
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
    label: "Dog",
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
    label: "Sea lion",
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

export const interactiveSelector = [
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

export function isCursorState(value: string | undefined): value is CursorVisualState {
  return cursorStates.includes(value as CursorVisualState);
}

export function storedCompanion(): CompanionId {
  const stored = localStorage.getItem("astralia.cursorCompanion.v2") as CompanionId | null;
  return companions.some(({ id }) => id === stored) ? stored! : "chibi";
}
