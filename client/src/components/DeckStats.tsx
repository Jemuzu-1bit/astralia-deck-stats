import { useMemo } from "react";
import type { Card } from "../types/Card";
import styles from "./DeckStats.module.scss";

export interface DeckStatsEntry {
  card: Card;
  qty: number;
}

interface DeckStatsProps {
  entries: DeckStatsEntry[];
  limit: number;
}

interface CountItem {
  label: string;
  count: number;
}

interface TypeStats extends CountItem {
  subtypes: CountItem[];
}

function sortCosts(a: CountItem, b: CountItem) {
  const isNumeric = (value: string) => /^\d+$/.test(value);
  const aIsNumeric = isNumeric(a.label);
  const bIsNumeric = isNumeric(b.label);

  if (aIsNumeric && bIsNumeric) return Number(a.label) - Number(b.label);
  if (aIsNumeric) return -1;
  if (bIsNumeric) return 1;
  return a.label.localeCompare(b.label);
}

export default function DeckStats({ entries, limit }: DeckStatsProps) {
  const { total, costs, types } = useMemo(() => {
    const costCounts = new Map<string, number>();
    const typeCounts = new Map<string, number>();
    const subtypeCounts = new Map<string, Map<string, number>>();
    let totalCards = 0;

    for (const { card, qty } of entries) {
      if (qty <= 0) continue;

      totalCards += qty;
      const cost = card.cost?.trim() || "—";
      const type = card.type?.trim() || "Other";
      const subtype = card.subtype?.trim() || "No subtype";

      costCounts.set(cost, (costCounts.get(cost) ?? 0) + qty);
      typeCounts.set(type, (typeCounts.get(type) ?? 0) + qty);

      const bySubtype = subtypeCounts.get(type) ?? new Map<string, number>();
      bySubtype.set(subtype, (bySubtype.get(subtype) ?? 0) + qty);
      subtypeCounts.set(type, bySubtype);
    }

    const costStats = Array.from(costCounts, ([label, count]) => ({
      label,
      count,
    })).sort(sortCosts);

    const typeStats = Array.from(typeCounts, ([label, count]) => ({
      label,
      count,
      subtypes: Array.from(subtypeCounts.get(label) ?? [], ([subtype, subtypeCount]) => ({
        label: subtype,
        count: subtypeCount,
      })).sort((a, b) => a.label.localeCompare(b.label)),
    })).sort((a, b) => a.label.localeCompare(b.label));

    return { total: totalCards, costs: costStats, types: typeStats };
  }, [entries]);

  return (
    <section className={styles.stats} aria-labelledby="mainDeckStatsTitle">
      <div className={styles.header}>
        <h3 id="mainDeckStatsTitle">Main Deck Statistics</h3>
        <span className={styles.total}>{total}/{limit}</span>
      </div>

      {total === 0 ? (
        <p className={styles.empty}>Add Main Deck cards to see statistics.</p>
      ) : (
        <div className={styles.content}>
          <div>
            <h4>Cost curve</h4>
            <div className={styles.costGrid}>
              {costs.map(({ label, count }) => (
                <div className={styles.costItem} key={label}>
                  <span>Cost {label}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4>Cards by type</h4>
            <div className={styles.typeList}>
              {types.map(({ label, count, subtypes }: TypeStats) => (
                <div className={styles.typeItem} key={label}>
                  <div className={styles.typeHeader}>
                    <span>{label}</span>
                    <strong>{count}</strong>
                  </div>
                  <div className={styles.subtypeList}>
                    {subtypes.map((subtype) => (
                      <span className={styles.subtype} key={subtype.label}>
                        {subtype.label} <strong>{subtype.count}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
