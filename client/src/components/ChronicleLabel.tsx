import type { ComponentProps, CSSProperties } from "react";
import { CHRONICLES, getChronicle, type Chronicle } from "../data/chronicles";
import { FACTIONS } from "../domain/deckBuilder";
import styles from "./ChronicleLabel.module.scss";

export function ChronicleBadge({ chronicle }: { chronicle: Chronicle }) {
  return <span className={styles.badge} style={{ "--faction-accent": chronicle.color } as CSSProperties}>
    {chronicle.factionLabel}
  </span>;
}

export default function ChronicleLabel({ faction, fullName = false, showFaction = false, className }: {
  faction: string;
  fullName?: boolean;
  showFaction?: boolean;
  className?: string;
}) {
  const chronicle = getChronicle(faction);
  if (!chronicle) return <span className={className}>{faction}</span>;

  const name = fullName ? `Chronicle of ${chronicle.name}` : chronicle.name;
  if (!showFaction) return <span className={className} style={{ color: chronicle.color }}>{name}</span>;

  return <span className={className ? `${styles.label} ${className}` : styles.label}>
    <span>{name}</span>
    <ChronicleBadge chronicle={chronicle} />
  </span>;
}

export function ChronicleSelect({ value, emptyLabel, style, ...props }: ComponentProps<"select"> & {
  value: string;
  emptyLabel: string;
}) {
  const color = getChronicle(value)?.color;

  return <select {...props} value={value} style={{ colorScheme: "dark", ...style, borderColor: color, color }}>
    <option value="" style={{ color: "var(--archive-muted)" }}>{emptyLabel}</option>
    {FACTIONS.map(faction => {
      const chronicle = CHRONICLES[faction];
      return <option key={faction} value={faction} style={{ color: chronicle.color }}>{chronicle.name}</option>;
    })}
  </select>;
}
