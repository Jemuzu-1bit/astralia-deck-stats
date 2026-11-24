import ChronicleLabel from "./ChronicleLabel";
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
              type="button"
              key={f}
              onClick={() => onSelect(f)}
              className={`${styles.factionButton} ${factionClass}`}
            >
              <span className={styles.factionLabel}><ChronicleLabel faction={f} fullName /></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
