import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { savedInterfaceSize, saveInterfaceSize } from "../services/gameInterfaceSize";
import { CursorPicker } from "./CustomCursor";
import styles from "./SettingsMenu.module.scss";

type SettingsMenuProps = {
  onClose: () => void;
  onShortcuts: () => void;
  children?: ReactNode;
};

export default function SettingsMenu({ onClose, onShortcuts, children }: SettingsMenuProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const onCloseRef = useRef(onClose);
  const [interfaceSize, setInterfaceSize] = useState(savedInterfaceSize);
  const [interfaceSizeDraft, setInterfaceSizeDraft] = useState(() => String(savedInterfaceSize()));

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

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const elementToRestore = previousFocus.current;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onCloseRef.current();
      } else if (event.key === "Tab") {
        const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>("button, a[href], input, select") ?? [])];
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      elementToRestore?.focus();
    };
  }, []);

  return <div className={styles.overlay} onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="settings-title" tabIndex={-1}>
      <div className={styles.header}><h2 id="settings-title">Settings</h2><button type="button" onClick={onClose} aria-label="Close settings">×</button></div>
      <CursorPicker />
      <button type="button" onClick={onShortcuts}>Keyboard shortcuts</button>
      <Link to="/help" target="_blank" rel="noopener noreferrer" onClick={onClose}>Guide</Link>
      {children}
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
    </div>
  </div>;
}
