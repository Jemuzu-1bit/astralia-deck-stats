import styles from "./FactionSelection.module.scss";

const CHRONICLE_NAMES: Record<string, string> = {
  green: "Chronicle of Heroes",
  red: "Chronicle of Twilight",
  blue: "Chronicle of Progress",
  pink: "Chronicle of Surveillance",
  purple: "Chronicle of Catastrophe",
};

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
          const chronicleName = CHRONICLE_NAMES[f.toLowerCase()] ?? f;
          const factionClass =
            (styles[`faction${cap}` as keyof typeof styles] as string) || "";
          return (
            <button
              key={f}
              onClick={() => onSelect(f)}
              className={`${styles.factionButton} ${factionClass}`}
              aria-label={`Select ${chronicleName}`}
            >
              <span className={styles.factionLabel}>{chronicleName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
