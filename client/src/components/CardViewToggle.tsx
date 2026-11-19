import styles from "./CardViewToggle.module.scss";

export type CardViewMode = "grid" | "list";

interface Props {
  label: string;
  value: CardViewMode;
  onChange: (value: CardViewMode) => void;
}

export default function CardViewToggle({ label, value, onChange }: Props) {
  return <div className={styles.toggle} role="group" aria-label={label}>
    {(["grid", "list"] as const).map(mode => <button
      key={mode}
      type="button"
      aria-pressed={value === mode}
      onClick={() => onChange(mode)}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        {mode === "grid"
          ? <path d="M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z" />
          : <path d="M3 5h2 M9 5h12 M3 12h2 M9 12h12 M3 19h2 M9 19h12" />}
      </svg>
      {mode === "grid" ? "Grid" : "List"}
    </button>)}
  </div>;
}
