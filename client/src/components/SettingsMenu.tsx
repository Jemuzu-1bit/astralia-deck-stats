import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import AppearanceSettings from "./AppearanceSettings";
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
  const [page, setPage] = useState<"settings" | "appearance">("settings");
  const appearanceButtonRef = useRef<HTMLButtonElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const hasMounted = useRef(false);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!hasMounted.current) { hasMounted.current = true; return; }
    (page === "appearance" ? backButtonRef : appearanceButtonRef).current?.focus();
  }, [page]);

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
      <div className={styles.header}>
        {page === "appearance" && <button ref={backButtonRef} type="button" onClick={() => setPage("settings")} aria-label="Back to settings">←</button>}
        <h2 id="settings-title">{page === "appearance" ? "Appearance" : "Settings"}</h2>
        <button type="button" onClick={onClose} aria-label="Close settings">×</button>
      </div>
      {page === "appearance" ? <AppearanceSettings /> : <>
        <button ref={appearanceButtonRef} type="button" onClick={() => setPage("appearance")}>Appearance</button>
        <button type="button" onClick={onShortcuts}>Keyboard shortcuts</button>
        <Link to="/help" target="_blank" rel="noopener noreferrer" onClick={onClose}>Guide</Link>
        {children}
      </>}
    </div>
  </div>;
}
