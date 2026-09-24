import styles from "./FactionSelection.module.scss";

interface FactionSelectionProps {
  factions: string[];
  onSelect: (faction: string) => void;
  onClose: () => void;
  heading?: string;
}

export default function FactionSelection({
  factions,
  onSelect,
  onClose,
  heading = "Select Deck Faction",
}: FactionSelectionProps) {
  return (
    <div className={styles.factionSelectionRoot}>
      <button
        type="button"
        className={styles.closeButton}
        onClick={onClose}
        aria-label="Close deck builder"
      >
        ✕
      </button>
      <h2 className={styles.heading}>{heading}</h2>
      <div className={styles.factionList}>
        {factions.map((f) => {
          const cap = f.charAt(0).toUpperCase() + f.slice(1);
          const factionClass =
            (styles[`faction${cap}` as keyof typeof styles] as string) || "";
          return (
            <button
              key={f}
              onClick={() => onSelect(f)}
              className={`${styles.factionButton} ${factionClass}`}
              aria-label={`Select ${f} faction`}
            >
              <span className={styles.factionLabel}>{f.toUpperCase()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
