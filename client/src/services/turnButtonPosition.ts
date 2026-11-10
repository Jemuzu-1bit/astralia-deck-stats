export type TurnButtonPosition = "center" | "oblivion" | "decks";

const TURN_BUTTON_POSITION_KEY = "astralia.turnButtonPosition.v1";
export const TURN_BUTTON_POSITION_CHANGE_EVENT = "astralia:turn-button-position-change";

export function savedTurnButtonPosition(): TurnButtonPosition {
  try {
    const value = localStorage.getItem(TURN_BUTTON_POSITION_KEY);
    if (value === "oblivion" || value === "decks") return value;
  } catch { /* use the default position */ }
  return "center";
}

export function saveTurnButtonPosition(value: TurnButtonPosition): void {
  try { localStorage.setItem(TURN_BUTTON_POSITION_KEY, value); } catch { /* keep this session's preference */ }
  window.dispatchEvent(new CustomEvent<TurnButtonPosition>(TURN_BUTTON_POSITION_CHANGE_EVENT, { detail: value }));
}
