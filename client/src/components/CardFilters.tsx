import { useMemo } from "react";
import type { AugCard } from "../types/AugCard";
import { getCardFilterValues } from "./cardFilterValues";
import styles from "./CardFilters.module.scss";

interface CardFiltersProps {
  options: AugCard[];
  searchText: string;
  setSearchText: (s: string) => void;
  selectedCosts: string[];
  setSelectedCosts: (v: (prev: string[]) => string[] | string[]) => void;
  selectedTypes: string[];
  setSelectedTypes: (v: (prev: string[]) => string[] | string[]) => void;
  selectedSubtypes: string[];
  setSelectedSubtypes: (v: (prev: string[]) => string[] | string[]) => void;
  selectedKeywords: string[];
  setSelectedKeywords: (v: (prev: string[]) => string[] | string[]) => void;
  selectedAtks: string[];
  setSelectedAtks: (v: (prev: string[]) => string[] | string[]) => void;
  selectedHps: string[];
  setSelectedHps: (v: (prev: string[]) => string[] | string[]) => void;
  clearFilters: () => void;
  hideTypeFilter?: boolean;
}

export default function CardFilters({
  options,
  searchText,
  setSearchText,
  selectedCosts,
  setSelectedCosts,
  selectedTypes,
  setSelectedTypes,
  selectedSubtypes,
  setSelectedSubtypes,
  selectedKeywords,
  setSelectedKeywords,
  selectedAtks,
  setSelectedAtks,
  selectedHps,
  setSelectedHps,
  clearFilters,
  hideTypeFilter,
}: CardFiltersProps) {
  const filterValues = useMemo(() => getCardFilterValues(options), [options]);

  return (
    <div className={styles.deckFilters}>
      <div className={styles.searchContainer}>
        <input
          className={styles.searchBar}
          placeholder="Search name or id"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />

        <button
          type="button"
          className={styles.clearFiltersButton}
          onClick={clearFilters}
        >
          Clear
        </button>
      </div>

      <div className={styles.filterRow}>
        {filterValues.costs.length > 0 && (
          <div className={styles.filterGroup}>
            <div className={styles.filterTitle}>Cost</div>
            <div className={styles.filterChips}>
              {filterValues.costs.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={
                    selectedCosts.includes(c)
                      ? styles.chip + " " + styles.activeChip
                      : styles.chip
                  }
                  onClick={() =>
                    setSelectedCosts((prev: string[]) =>
                      prev.includes(c)
                        ? prev.filter((x) => x !== c)
                        : [...prev, c]
                    )
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {filterValues.types.length > 0 && !hideTypeFilter && (
          <div className={styles.filterGroup}>
            <div className={styles.filterTitle}>Type</div>
            <div className={styles.filterChips}>
              {filterValues.types.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={
                    selectedTypes.includes(t)
                      ? styles.chip + " " + styles.activeChip
                      : styles.chip
                  }
                  onClick={() =>
                    setSelectedTypes((prev: string[]) =>
                      prev.includes(t)
                        ? prev.filter((x) => x !== t)
                        : [...prev, t]
                    )
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {filterValues.subtypes.length > 0 && (
          <div className={styles.filterGroup}>
            <div className={styles.filterTitle}>Subtype</div>
            <div className={styles.filterChips}>
              {filterValues.subtypes.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={
                    selectedSubtypes.includes(s)
                      ? styles.chip + " " + styles.activeChip
                      : styles.chip
                  }
                  onClick={() =>
                    setSelectedSubtypes((prev: string[]) =>
                      prev.includes(s)
                        ? prev.filter((x) => x !== s)
                        : [...prev, s]
                    )
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {filterValues.keywords.length > 0 && (
          <div className={styles.filterGroup}>
            <div className={styles.filterTitle}>Keyword</div>
            <div className={styles.filterChips}>
              {filterValues.keywords.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={
                    selectedKeywords.includes(k)
                      ? styles.chip + " " + styles.activeChip
                      : styles.chip
                  }
                  onClick={() =>
                    setSelectedKeywords((prev: string[]) =>
                      prev.includes(k)
                        ? prev.filter((x) => x !== k)
                        : [...prev, k]
                    )
                  }
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        )}

        {filterValues.atks.length > 0 && (
          <div className={styles.filterGroup}>
            <div className={styles.filterTitle}>ATK</div>
            <div className={styles.filterChips}>
              {filterValues.atks.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={
                    selectedAtks.includes(a)
                      ? styles.chip + " " + styles.activeChip
                      : styles.chip
                  }
                  onClick={() =>
                    setSelectedAtks((prev: string[]) =>
                      prev.includes(a)
                        ? prev.filter((x) => x !== a)
                        : [...prev, a]
                    )
                  }
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}

        {filterValues.hps.length > 0 && (
          <div className={styles.filterGroup}>
            <div className={styles.filterTitle}>HP</div>
            <div className={styles.filterChips}>
              {filterValues.hps.map((h) => (
                <button
                  key={h}
                  type="button"
                  className={
                    selectedHps.includes(h)
                      ? styles.chip + " " + styles.activeChip
                      : styles.chip
                  }
                  onClick={() =>
                    setSelectedHps((prev: string[]) =>
                      prev.includes(h)
                        ? prev.filter((x) => x !== h)
                        : [...prev, h]
                    )
                  }
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
