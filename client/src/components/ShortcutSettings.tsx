import { useEffect, useRef, useState } from "react";
import {
  conflictingShortcut, normalizeShortcut, resetGameShortcuts, setGameShortcut,
  SHORTCUT_LABELS, useGameShortcuts, type ShortcutScope,
} from "../pages/gameShortcuts";
import styles from "./ShortcutSettings.module.scss";

const sections: { scope: ShortcutScope; title: string; hint: string }[] = [
  { scope: "card", title: "Carte", hint: "Cursore su una carta o menu della carta aperto" },
  { scope: "deck", title: "Mazzo", hint: "Cursore sul mazzo o menu del mazzo aperto" },
  { scope: "fragment", title: "Fragment", hint: "Cursore sull'area Fragment" },
  { scope: "counter", title: "Counter", hint: "Cursore su un counter o nel menu dei counter" },
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
        setError("Premi un solo tasto: lettera, cifra, Spazio, Delete o una freccia. Nessuna combinazione.");
        return;
      }
      const conflict = conflictingShortcut(capturing.scope, capturing.action, key, bindings);
      if (conflict) {
        const labels = SHORTCUT_LABELS[capturing.scope] as Record<string, string>;
        setError(`${key} è già assegnato a «${labels[conflict]}» in questa sezione.`);
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
        <div><h2 id="shortcut-settings-title">Comandi da tastiera</h2><p>Passa il cursore sull'elemento e premi un solo tasto. Le modifiche vengono salvate in questo browser.</p></div>
        <button type="button" onClick={onClose} aria-label="Chiudi comandi da tastiera">×</button>
      </header>
      <div className={styles.sections}>
        {sections.map(({ scope, title, hint }) => <section key={scope}>
          <h3>{title}</h3><p>{hint}</p>
          <div className={styles.rows}>
            {Object.entries(SHORTCUT_LABELS[scope]).map(([action, label]) => <div className={styles.row} key={action}>
              <span>{label}</span>
              <kbd>{(bindings[scope] as Record<string, string>)[action]}</kbd>
              <button type="button" aria-label={`Modifica ${label}`} aria-pressed={capturing?.scope === scope && capturing.action === action} onClick={() => { setCapturing({ scope, action }); setError(""); }}>
                {capturing?.scope === scope && capturing.action === action ? "Premi un tasto…" : "Modifica"}
              </button>
            </div>)}
          </div>
        </section>)}
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <footer><button type="button" onClick={() => { resetGameShortcuts(); setCapturing(null); setError(""); }}>Ripristina predefiniti</button><button type="button" onClick={onClose}>Chiudi</button></footer>
    </div>
  </div>;
}
