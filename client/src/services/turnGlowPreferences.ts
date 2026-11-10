export type TurnGlowPreferences = {
  intensity: number;
  size: number;
  shape: "oval" | "round" | "cone";
  colorMode: "faction" | "custom";
  customColor: string;
};

const TURN_GLOW_KEY = "astralia.turnGlow.v1";
export const TURN_GLOW_CHANGE_EVENT = "astralia:turn-glow-change";

const defaults: TurnGlowPreferences = {
  intensity: 100,
  size: 100,
  shape: "oval",
  colorMode: "faction",
  customColor: "#d4af37",
};

export function savedTurnGlowPreferences(): TurnGlowPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(TURN_GLOW_KEY) ?? "null");
    if (!value || typeof value !== "object") return { ...defaults };
    return {
      intensity: Number.isInteger(value.intensity) && value.intensity >= 0 && value.intensity <= 200 ? value.intensity : defaults.intensity,
      size: Number.isInteger(value.size) && value.size >= 50 && value.size <= 150 ? value.size : defaults.size,
      shape: value.shape === "round" || value.shape === "cone" ? value.shape : defaults.shape,
      colorMode: value.colorMode === "custom" ? "custom" : "faction",
      customColor: typeof value.customColor === "string" && /^#[0-9a-fA-F]{6}$/.test(value.customColor) ? value.customColor : defaults.customColor,
    };
  } catch { return { ...defaults }; }
}

export function saveTurnGlowPreferences(value: TurnGlowPreferences): void {
  try { localStorage.setItem(TURN_GLOW_KEY, JSON.stringify(value)); } catch { /* keep this session's preference */ }
  window.dispatchEvent(new CustomEvent<TurnGlowPreferences>(TURN_GLOW_CHANGE_EVENT, { detail: value }));
}
