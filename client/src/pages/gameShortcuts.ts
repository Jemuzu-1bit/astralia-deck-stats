import { useSyncExternalStore } from "react";

export const DEFAULT_SHORTCUTS = {
  card: {
    frazzleAdd: "F", frazzleRemove: "M", atk: "A", hp: "H", counters: "C",
    play: "Spazio", swap: "Spazio", attach: "E", target: "O", clearTarget: "X",
    flip: "I", faceDown: "J", control: "G", reveal: "J",
    deckTop: "T", deckBottom: "Y", oblivion: "S", persona: "P", hand: "R", graveyard: "D",
  },
  deck: {
    shuffle: "V", drawOne: "C", draw: "X", discard: "D",
    look: "L", oblivion: "S", search: "F",
  },
  fragment: {
    add: "N", remove: "M", spend: "S", recover: "R",
    spendAll: "T", recoverAll: "A",
    toggle1: "1", toggle2: "2", toggle3: "3", toggle4: "4", toggle5: "5",
    toggle6: "6", toggle7: "7", toggle8: "8", toggle9: "9", toggle10: "0",
  },
  counter: {
    increase: "A", decrease: "D", remove: "X",
    preset1: "1", preset2: "2", preset3: "3", preset4: "4",
    preset5: "5", preset6: "6", preset7: "7",
  },
} as const;

export type ShortcutScope = keyof typeof DEFAULT_SHORTCUTS;
export type ShortcutBindings = { [S in ShortcutScope]: { [A in keyof typeof DEFAULT_SHORTCUTS[S]]: string } };
type ShortcutAction<S extends ShortcutScope> = keyof typeof DEFAULT_SHORTCUTS[S];

export const SHORTCUT_LABELS: { [S in ShortcutScope]: { [A in ShortcutAction<S>]: string } } = {
  card: {
    frazzleAdd: "Aggiungi Frazzle", frazzleRemove: "Rimuovi Frazzle", atk: "Imposta o rimuovi ATK",
    hp: "Imposta o rimuovi HP", counters: "Apri i counter", play: "Gioca Action",
    swap: "Scambia con la carta principale", attach: "Attacca a un'altra carta",
    target: "Scegli bersaglio", clearTarget: "Cancella bersaglio", flip: "Gira carta",
    faceDown: "Faccia coperta o scoperta", control: "Cedi o riprendi controllo",
    reveal: "Rivela o nascondi dalla mano", deckTop: "In cima al mazzo",
    deckBottom: "In fondo al mazzo", oblivion: "In Oblivion", persona: "In Persona",
    hand: "In mano", graveyard: "Nel Graveyard",
  },
  deck: {
    shuffle: "Mescola", drawOne: "Pesca una carta", draw: "Pesca X carte",
    discard: "Scarta X carte", look: "Guarda le prime X", oblivion: "X carte in Oblivion",
    search: "Cerca nel mazzo",
  },
  fragment: {
    add: "Aggiungi Fragment", remove: "Rimuovi Fragment", spend: "Spendi Fragment",
    recover: "Recupera Fragment", spendAll: "Spendi tutti", recoverAll: "Recupera tutti",
    toggle1: "Fragment 1", toggle2: "Fragment 2", toggle3: "Fragment 3",
    toggle4: "Fragment 4", toggle5: "Fragment 5", toggle6: "Fragment 6",
    toggle7: "Fragment 7", toggle8: "Fragment 8", toggle9: "Fragment 9",
    toggle10: "Fragment 10",
  },
  counter: {
    increase: "Aumenta counter", decrease: "Diminuisci counter", remove: "Rimuovi counter",
    preset1: "Quest", preset2: "Omen", preset3: "Shield", preset4: "Astralia Gear",
    preset5: "Explosion", preset6: "Renown", preset7: "Advent",
  },
};

const STORAGE_KEY = "astralia.gameShortcuts.v1";
const scopes: ShortcutScope[] = ["card", "deck", "fragment", "counter"];
const sharedCardPairs = [new Set(["play", "swap"]), new Set(["faceDown", "reveal"])];

export function normalizeShortcut(event: KeyboardEvent): string | null {
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return null;
  if (event.key === " ") return "Spazio";
  if (event.key === "Delete") return "Delete";
  if (event.key === "ArrowUp" || event.key === "ArrowDown") return event.key;
  if (event.key === "+" || event.key === "-") return event.key;
  if (!/^[a-z0-9+-]$/i.test(event.key)) return null;
  return event.key.toUpperCase();
}

function isValidBinding(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value === "Spazio" || value === "Delete" || value === "ArrowUp" || value === "ArrowDown") return true;
  return /^[A-Z0-9]$/.test(value) || value === "+" || value === "-";
}

function loadShortcuts(): ShortcutBindings {
  let saved: unknown;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch { saved = null; }
  const result = {} as ShortcutBindings;
  for (const scope of scopes) {
    const defaults = DEFAULT_SHORTCUTS[scope] as Record<string, string>;
    const storedScope = saved && typeof saved === "object" && scope in saved
      ? (saved as Record<string, unknown>)[scope] : null;
    const stored = storedScope && typeof storedScope === "object" ? storedScope as Record<string, unknown> : {};
    (result as unknown as Record<string, Record<string, string>>)[scope] = Object.fromEntries(
      Object.entries(defaults).map(([action, fallback]) => [action, isValidBinding(stored[action]) ? stored[action] : fallback]),
    );
  }
  return result;
}

let currentShortcuts = loadShortcuts();
const listeners = new Set<() => void>();
const publish = (next: ShortcutBindings) => {
  currentShortcuts = next;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* preferences still work for this tab */ }
  listeners.forEach((listener) => listener());
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    currentShortcuts = loadShortcuts();
    listeners.forEach((callback) => callback());
  };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}

export function useGameShortcuts() {
  return useSyncExternalStore(subscribe, () => currentShortcuts);
}

export function conflictingShortcut(scope: ShortcutScope, action: string, value: string, bindings = currentShortcuts): string | null {
  const entries = bindings[scope] as Record<string, string>;
  for (const [other, assigned] of Object.entries(entries)) {
    if (other === action || assigned !== value) continue;
    if (scope === "card" && sharedCardPairs.some((pair) => pair.has(action) && pair.has(other))) continue;
    return other;
  }
  return null;
}

export function setGameShortcut(scope: ShortcutScope, action: string, value: string): boolean {
  if (!isValidBinding(value) || !(action in DEFAULT_SHORTCUTS[scope]) || conflictingShortcut(scope, action, value)) return false;
  publish({ ...currentShortcuts, [scope]: { ...currentShortcuts[scope], [action]: value } });
  return true;
}

export function resetGameShortcuts() {
  publish(Object.fromEntries(scopes.map((scope) => [scope, { ...DEFAULT_SHORTCUTS[scope] }])) as ShortcutBindings);
}
