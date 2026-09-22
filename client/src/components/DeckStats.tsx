import { useMemo, type CSSProperties } from "react";
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

const MAIN_DECK_COSTS = Array.from({ length: 11 }, (_, cost) => String(cost));
const TYPE_ORDER = ["Character", "Action", "Scenography"];

function sortTypes(a: TypeStats, b: TypeStats) {
  const aIndex = TYPE_ORDER.indexOf(a.label);
  const bIndex = TYPE_ORDER.indexOf(b.label);
  const aRank = aIndex === -1 ? TYPE_ORDER.length : aIndex;
  const bRank = bIndex === -1 ? TYPE_ORDER.length : bIndex;

  if (aRank !== bRank) return aRank - bRank;
  return a.label.localeCompare(b.label);
}

export default function DeckStats({ entries, limit }: DeckStatsProps) {
  const { total, costs, types } = useMemo(() => {
    const costCounts = new Map<string, number>();
    const outsideCurveCounts = new Map<string, number>();
    const typeCounts = new Map<string, number>();
    const subtypeCounts = new Map<string, Map<string, number>>();
    let totalCards = 0;

    for (const { card, qty } of entries) {
      if (qty <= 0) continue;

      totalCards += qty;
      const cost = card.cost?.trim() || "—";
      const type = card.type?.trim() || "Other";
      const subtype = card.subtype?.trim() || "No subtype";

      if (MAIN_DECK_COSTS.includes(cost)) {
        costCounts.set(cost, (costCounts.get(cost) ?? 0) + qty);
      } else {
        outsideCurveCounts.set(cost, (outsideCurveCounts.get(cost) ?? 0) + qty);
      }
      typeCounts.set(type, (typeCounts.get(type) ?? 0) + qty);

      const bySubtype = subtypeCounts.get(type) ?? new Map<string, number>();
      bySubtype.set(subtype, (bySubtype.get(subtype) ?? 0) + qty);
      subtypeCounts.set(type, bySubtype);
    }

    const costStats = [
      ...MAIN_DECK_COSTS.map((label) => ({
        label,
        count: costCounts.get(label) ?? 0,
      })),
      ...Array.from(outsideCurveCounts, ([label, count]) => ({ label, count })).sort(
        (a, b) => a.label.localeCompare(b.label)
      ),
    ];

    const typeStats = Array.from(typeCounts, ([label, count]) => ({
      label,
      count,
      subtypes: Array.from(subtypeCounts.get(label) ?? [], ([subtype, subtypeCount]) => ({
        label: subtype,
        count: subtypeCount,
      })).sort((a, b) => a.label.localeCompare(b.label)),
    })).sort(sortTypes);

    return {
      total: totalCards,
      costs: costStats,
      types: typeStats,
    };
  }, [entries]);
  const highestCostCount = Math.max(...costs.map((cost) => cost.count), 1);

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
            <div
              className={styles.costChart}
              role="img"
              aria-label={`Cost curve: ${costs
                .map(({ label, count }) => `cost ${label}, ${count} cards`)
                .join("; ")}`}
            >
              {costs.map(({ label, count }) => (
                <div className={styles.costColumn} key={label}>
                  <strong className={styles.costValue}>{count}</strong>
                  <div className={styles.barArea}>
                    <div
                      className={styles.costBar}
                      style={
                        {
                          "--bar-height":
                            count === 0
                              ? "0%"
                              : `${(count / highestCostCount) * 100}%`,
                        } as CSSProperties
                      }
                    />
                  </div>
                  <span className={styles.costLabel}>{label}</span>
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
