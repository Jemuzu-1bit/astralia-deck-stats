import React, { useRef } from "react";
import { useModalFocus } from "../hooks/useModalFocus";
import styles from "./ModalDialog.module.scss";

type Action = { label: string; onClick: () => void; disabled?: boolean };

interface ModalDialogProps {
  title?: string;
  children?: React.ReactNode;
  onClose?: () => void;
  primary?: Action;
  secondary?: Action;
  ariaId?: string;
}

export default function ModalDialog({
  title,
  children,
  onClose,
  primary,
  secondary,
  ariaId,
}: ModalDialogProps) {
  const dialog = useRef<HTMLDivElement>(null);
  useModalFocus(dialog);
  const overlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && onClose) onClose();
  };

  return (
    <div className={styles.modalOverlay} onMouseDown={overlayClick}>
      <div
        ref={dialog}
        tabIndex={-1}
        onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onClose?.(); } }}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaId}
      >
        {title && (
          <h3 id={ariaId} className={styles.dialogTitle}>
            {title}
          </h3>
        )}

        <div className={styles.dialogBody}>{children}</div>

        <div className={styles.dialogActions}>
          {secondary && (
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={secondary.onClick}
              disabled={secondary.disabled}
            >
              {secondary.label}
            </button>
          )}
          {primary && (
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={primary.onClick}
              disabled={primary.disabled}
            >
              {primary.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
