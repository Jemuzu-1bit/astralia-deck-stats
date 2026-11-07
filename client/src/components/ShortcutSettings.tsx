import { useEffect, useRef, useState } from "react";
import {
  conflictingShortcut, normalizeShortcut, resetGameShortcuts, setGameShortcut,
  SHORTCUT_LABELS, useGameShortcuts, type ShortcutScope,
} from "../pages/gameShortcuts";
import styles from "./ShortcutSettings.module.scss";

const sections: { scope: ShortcutScope; title: string; hint: string }[] = [
  { scope: "card", title: "Cards", hint: "Point to a card or open its menu" },
  { scope: "deck", title: "Deck", hint: "Point to a deck or open its menu" },
  { scope: "fragment", title: "Fragments", hint: "Point to the Fragment area" },
  { scope: "counter", title: "Counters", hint: "Point to a counter or open its menu" },
];

export default function ShortcutSettings({ onClose }: { onClose: () => void }) {
  const bindings = useGameShortcuts();
  const [capturing, setCapturing] = useState<{ scope: ShortcutScope; action: string } | null>(null);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(document.activeElement instanceof HTMLElement ? document.activeElement : null);

  useEffect(() => {
    const elementToRestore = previousFocus.current;
    dialogRef.current?.focus();
    return () => elementToRestore?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab" && !capturing) {
        const buttons = [...(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (capturing) { setCapturing(null); setError(""); }
        else onClose();
        return;
      }
      if (!capturing) return;
      if (["Shift", "Control", "Alt", "Meta"].includes(event.key)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const key = normalizeShortcut(event);
      if (!key) {
        setError("Press one key: a letter, number, Space, Delete, or an arrow key. Key combinations are not supported.");
        return;
      }
      const conflict = conflictingShortcut(capturing.scope, capturing.action, key, bindings);
      if (conflict) {
        const labels = SHORTCUT_LABELS[capturing.scope] as Record<string, string>;
        setError(`${key} is already assigned to "${labels[conflict]}" in this section.`);
        return;
      }
      setGameShortcut(capturing.scope, capturing.action, key);
      setCapturing(null);
      setError("");
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [bindings, capturing, onClose]);

  return <div className={styles.overlay} onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="shortcut-settings-title" tabIndex={-1}>
      <header className={styles.header}>
        <div><h2 id="shortcut-settings-title">Keyboard shortcuts</h2><p>Point to an item and press one key. Your changes are saved in this browser.</p></div>
        <button type="button" onClick={onClose} aria-label="Close keyboard shortcuts">×</button>
      </header>
      <div className={styles.sections}>
        {sections.map(({ scope, title, hint }) => <section key={scope}>
          <h3>{title}</h3><p>{hint}</p>
          <div className={styles.rows}>
            {Object.entries(SHORTCUT_LABELS[scope]).map(([action, label]) => <div className={styles.row} key={action}>
              <span>{label}</span>
              <kbd>{(bindings[scope] as Record<string, string>)[action]}</kbd>
              <button type="button" aria-label={`Change shortcut for ${label}`} aria-pressed={capturing?.scope === scope && capturing.action === action} onClick={() => { setCapturing({ scope, action }); setError(""); }}>
                {capturing?.scope === scope && capturing.action === action ? "Press a key…" : "Change"}
              </button>
            </div>)}
          </div>
        </section>)}
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <footer><button type="button" onClick={() => { resetGameShortcuts(); setCapturing(null); setError(""); }}>Reset to defaults</button><button type="button" onClick={onClose}>Close</button></footer>
    </div>
  </div>;
}
