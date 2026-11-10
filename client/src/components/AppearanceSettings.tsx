import { useState, type CSSProperties } from "react";
import { savedInterfaceSize, saveInterfaceSize } from "../services/gameInterfaceSize";
import { savedTurnButtonPosition, saveTurnButtonPosition, type TurnButtonPosition } from "../services/turnButtonPosition";
import { savedTurnGlowPreferences, saveTurnGlowPreferences, type TurnGlowPreferences } from "../services/turnGlowPreferences";
import { CursorPicker } from "./CustomCursor";
import styles from "./SettingsMenu.module.scss";

export default function AppearanceSettings() {
  const [interfaceSize, setInterfaceSize] = useState(savedInterfaceSize);
  const [interfaceSizeDraft, setInterfaceSizeDraft] = useState(() => String(savedInterfaceSize()));
  const [turnButtonPosition, setTurnButtonPosition] = useState(savedTurnButtonPosition);
  const [glow, setGlow] = useState(savedTurnGlowPreferences);

  const updateInterfaceSize = (value: number) => {
    setInterfaceSize(value);
    setInterfaceSizeDraft(String(value));
    saveInterfaceSize(value);
  };

  const commitInterfaceSize = () => {
    const entered = Number(interfaceSizeDraft);
    updateInterfaceSize(interfaceSizeDraft.trim() !== "" && Number.isFinite(entered)
      ? Math.min(150, Math.max(75, Math.round(entered))) : interfaceSize);
  };

  const updateGlow = (changes: Partial<TurnGlowPreferences>) => {
    const next = { ...glow, ...changes };
    setGlow(next);
    saveTurnGlowPreferences(next);
  };

  return <div className={styles.appearanceSettings}>
    <CursorPicker />
    <fieldset className={styles.turnPositionControl}>
      <legend>End turn button</legend>
      <label htmlFor="turn-button-position">Position on the center line</label>
      <select id="turn-button-position" value={turnButtonPosition} onChange={(event) => {
        const position = event.target.value as TurnButtonPosition;
        setTurnButtonPosition(position);
        saveTurnButtonPosition(position);
      }}>
        <option value="center">Center</option>
        <option value="oblivion">Between Oblivion zones</option>
        <option value="decks">Between decks</option>
      </select>
    </fieldset>
    <fieldset className={styles.glowControl}>
      <legend>Turn light</legend>
      <div className={styles.glowPreview} style={{
        "--preview-glow-color": glow.colorMode === "custom" ? glow.customColor : "#d4af37",
        "--preview-glow-opacity": `${Math.round(glow.intensity * 32 / 100)}%`,
        "--preview-line-opacity": `${Math.min(100, Math.round(glow.intensity * 60 / 100))}%`,
        "--preview-glow-size": glow.size / 100,
      } as CSSProperties} data-glow-shape={glow.shape} aria-label="Turn light preview" role="img"><span /></div>
      <p className={styles.glowPreviewNote}>Preview uses gold for the faction color.</p>
      <label htmlFor="turn-glow-intensity">Intensity <output>{glow.intensity}%</output></label>
      <input id="turn-glow-intensity" type="range" min={0} max={200} step={5} value={glow.intensity} onChange={(event) => updateGlow({ intensity: Number(event.target.value) })} aria-valuetext={glow.intensity === 0 ? "Off" : `${glow.intensity}%`} />
      <div className={styles.glowMarks}><span>Off</span><span>Default</span><span>Bright</span></div>
      <label htmlFor="turn-glow-size">Size <output>{glow.size}%</output></label>
      <input id="turn-glow-size" type="range" min={50} max={150} step={5} value={glow.size} onChange={(event) => updateGlow({ size: Number(event.target.value) })} aria-valuetext={`${glow.size}%`} />
      <div className={styles.glowMarks}><span>Small</span><span>Default</span><span>Large</span></div>
      <label htmlFor="turn-glow-shape">Shape</label>
      <select id="turn-glow-shape" value={glow.shape} onChange={(event) => updateGlow({ shape: event.target.value as TurnGlowPreferences["shape"] })}>
        <option value="oval">Oval</option>
        <option value="round">Round</option>
        <option value="cone">Cone</option>
      </select>
      <label htmlFor="turn-glow-color-mode">Color</label>
      <select id="turn-glow-color-mode" value={glow.colorMode} onChange={(event) => updateGlow({ colorMode: event.target.value as TurnGlowPreferences["colorMode"] })}>
        <option value="faction">Faction color</option>
        <option value="custom">Custom color</option>
      </select>
      {glow.colorMode === "custom" && <label className={styles.customGlowColor} htmlFor="turn-glow-custom-color">
        Choose color
        <input id="turn-glow-custom-color" type="color" value={glow.customColor} onChange={(event) => updateGlow({ customColor: event.target.value })} />
      </label>}
    </fieldset>
    <fieldset className={styles.interfaceSizeControl}>
      <legend>Display size</legend>
      <label htmlFor="interface-size-slider">Match display size</label>
      <div className={styles.interfaceSizeEntry}>
        <input id="interface-size-value" type="number" min={75} max={150} step={1} inputMode="numeric" aria-label="Display size percentage" value={interfaceSizeDraft} onChange={(event) => {
          const draft = event.target.value;
          setInterfaceSizeDraft(draft);
          const value = Number(draft);
          if (draft !== "" && Number.isInteger(value) && value >= 75 && value <= 150) updateInterfaceSize(value);
        }} onBlur={commitInterfaceSize} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }} />
        <span>%</span>
      </div>
      <input id="interface-size-slider" type="range" min={75} max={150} step={1} value={interfaceSize} onChange={(event) => updateInterfaceSize(Number(event.target.value))} aria-valuetext={`${interfaceSize}%`} />
      <div className={styles.interfaceSizeMarks}><span>75%</span><span>150%</span></div>
    </fieldset>
  </div>;
}
