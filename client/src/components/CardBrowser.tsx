import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { AugCard } from "../types/AugCard";
import type { Card } from "../types/Card";
import type { CardFiltersState } from "../hooks/useCardFilters";
import { CARD_SETS, filterCards, type DeckSection } from "../domain/deckBuilder";
import { getCardFilterValues } from "./cardFilterValues";
import CardDisplay from "./CardDisplay";
import type { CardViewMode } from "./CardViewToggle";
import ArchiveIcon from "./ArchiveIcon";
import type { CollectionCardDrag } from "./deckCollectionDrag";
import styles from "./CardBrowser.module.scss";

export interface CardDestination {
  section: DeckSection;
  quantity: number;
  full: boolean;
  disabledReason?: string;
}

interface Props {
  options: AugCard[];
  filters: CardFiltersState;
  onOpenCard: (card: Card) => void;
  destinations?: (card: Card) => CardDestination[];
  onAdd?: (section: DeckSection, card: Card) => void;
  onRemove?: (section: DeckSection, card: Card) => void;
  loading?: boolean;
  error?: string | null;
  viewMode?: CardViewMode;
  gridZoom?: number;
  autoLoadMore?: boolean;
  scrollRootRef?: RefObject<HTMLElement | null>;
}

const CARD_PAGE_SIZE = 60;
const setOptions = CARD_SETS.map(({ code, label }) => ({ value: code, label }));
const costValues = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "X"];
const quantityLabels: Record<DeckSection, string> = { protagonist: "selected", persona: "in Persona", deck: "in Main", sideboard: "in Side" };

interface FilterDropdownProps<Value extends string> {
  label: string;
  options: readonly { value: Value; label: string }[];
  selected: readonly Value[];
  selectionLabel?: string;
  optionsClassName?: string;
  onToggle: (value: Value) => void;
  onClear: () => void;
}

function FilterDropdown<Value extends string>({ label, options, selected, selectionLabel, optionsClassName, onToggle, onClear }: FilterDropdownProps<Value>) {
  const allSelected = selected.length === 0;
  const filterName = label.toLowerCase();
  const allLabel = `All ${filterName}s`;
  const selectedLabel = selectionLabel ?? (selected.length === 1 ? selected[0] : `${selected.length} ${filterName}s`);
  const summary = allSelected ? allLabel : selectedLabel;

  return <div className={styles.dropdownField}>
    <span className={styles.dropdownLabel} aria-hidden="true">{label}</span>
    <details
      className={styles.filterDropdown}
      onBlur={event => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
          event.currentTarget.open = false;
        }
      }}
      onKeyDown={event => {
        const menu = event.currentTarget;
        if (event.key !== "Escape" || !menu.open) return;
        event.preventDefault();
        event.stopPropagation();
        menu.open = false;
        menu.querySelector("summary")?.focus();
      }}
    >
      <summary
        className={`${styles.dropdownControl} ${styles.filterTrigger}`}
        data-filtered={!allSelected || undefined}
        aria-label={`Filter by ${filterName} (${summary})`}
      >
        {summary}
      </summary>
      <div className={optionsClassName ? `${styles.filterOptions} ${optionsClassName}` : styles.filterOptions} role="group" aria-label={`Card ${filterName}s`}>
        <label>
          <input
            type="checkbox"
            checked={allSelected}
            aria-disabled={allSelected || undefined}
            onChange={event => {
              if (event.currentTarget.checked) onClear();
            }}
          />
          {allLabel}
        </label>
        {options.map(option => <label key={option.value}>
          <input type="checkbox" value={option.value} checked={selected.includes(option.value)} onChange={() => onToggle(option.value)} />
          {option.label}
        </label>)}
      </div>
    </details>
  </div>;
}

function CollectionCardArt({ card, destinations, quantities, viewMode, onOpenCard }: {
  card: Card;
  destinations: DeckSection[];
  quantities: CardDestination[];
  viewMode: CardViewMode;
  onOpenCard: Props["onOpenCard"];
}) {
  const draggable = destinations.length > 0;
  const collectionCard: CollectionCardDrag = { card, destinations };
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: `collection:${card.id}`,
    data: { collectionCard },
    disabled: !draggable,
  });

  return <div
    ref={draggable ? setNodeRef : undefined}
    className={styles.art}
    data-draggable={draggable || undefined}
    data-dragging={isDragging || undefined}
    {...listeners}
  >
    <CardDisplay card={card} onClick={onOpenCard} enableFlip={viewMode === "grid"} />
    {viewMode === "grid" && quantities.length > 0 && <span className={styles.badge}>
      {quantities.map(target => <span key={target.section}>{target.quantity} {quantityLabels[target.section]}</span>)}
    </span>}
  </div>;
}

export default function CardBrowser({ options, filters, onOpenCard, destinations, onAdd, onRemove, loading, error, viewMode = "grid", gridZoom, autoLoadMore = false, scrollRootRef }: Props) {
  const [sort, setSort] = useState("cost");
  const [pageSize, setPageSize] = useState(CARD_PAGE_SIZE);
  const [advanced, setAdvanced] = useState(false);
  const filterBar = useRef<HTMLDivElement>(null);
  const loadMoreTrigger = useRef<HTMLDivElement>(null);
  const gridStyle = viewMode === "grid" && gridZoom !== undefined
    ? { "--card-grid-scale": gridZoom / 100 } as CSSProperties
    : undefined;
  const resultsLayout = viewMode === "list" ? styles.list : styles.grid;
  const values = getCardFilterValues(options);
  const filtered = filterCards(options, filters).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : (Number(a.cost) || 0) - (Number(b.cost) || 0) || a.name.localeCompare(b.name));
  const filterGroups = [
    { label: "Type", values: values.types, selected: filters.selectedTypes, set: filters.setSelectedTypes },
    { label: "Cost", values: [...costValues, ...values.costs], selected: filters.selectedCosts, set: filters.setSelectedCosts, optionsClassName: styles.costOptions },
    { label: "Subtype", values: values.subtypes, selected: filters.selectedSubtypes, set: filters.setSelectedSubtypes },
    { label: "Keyword", values: values.keywords, selected: filters.selectedKeywords, set: filters.setSelectedKeywords },
    { label: "ATK", values: values.atks, selected: filters.selectedAtks, set: filters.setSelectedAtks },
    { label: "HP", values: values.hps, selected: filters.selectedHps, set: filters.setSelectedHps },
  ];
  const filterCount = filterGroups.reduce((sum, group) => sum + group.selected.length, filters.selectedSets.length);
  const query = autoLoadMore ? JSON.stringify([filters.searchText, filters.selectedSets, sort, ...filterGroups.map(group => group.selected)]) : null;
  const [paginationResults, setPaginationResults] = useState({ options, query });
  if (autoLoadMore && (paginationResults.options !== options || paginationResults.query !== query)) {
    setPaginationResults({ options, query });
    setPageSize(CARD_PAGE_SIZE);
  }

  useEffect(() => {
    const dismissFilterMenus = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const openMenus = filterBar.current?.querySelectorAll<HTMLDetailsElement>("details[open]");
      openMenus?.forEach(menu => {
        if (!menu.contains(target)) menu.open = false;
      });
    };
    document.addEventListener("pointerdown", dismissFilterMenus);
    return () => document.removeEventListener("pointerdown", dismissFilterMenus);
  }, []);

  const hasMore = filtered.length > pageSize;
  const canAutoLoad = autoLoadMore && typeof IntersectionObserver !== "undefined";
  const showLoadTrigger = canAutoLoad && hasMore && !loading && !error;
  useEffect(() => {
    const trigger = loadMoreTrigger.current;
    if (!showLoadTrigger || !trigger) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      setPageSize(size => size + CARD_PAGE_SIZE);
    }, { root: scrollRootRef?.current, rootMargin: "0px 0px 400px 0px" });
    observer.observe(trigger);
    return () => observer.disconnect();
  }, [showLoadTrigger, pageSize, paginationResults, scrollRootRef]);

  return <div className={styles.browser}>
    <div className={styles.searchRow}><label className={styles.search}><ArchiveIcon name="search" size={18} /><input aria-label="Search cards" placeholder="Search cards by name or ID…" value={filters.searchText} onChange={event => { filters.setSearchText(event.target.value); setPageSize(CARD_PAGE_SIZE); }} />{filters.searchText && <button aria-label="Clear card search" onClick={() => filters.setSearchText("")}><ArchiveIcon name="close" size={15} /></button>}</label><button className={styles.filterToggle} aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>Filters{filterCount > 0 ? ` (${filterCount})` : ""}</button></div>
    <div className={styles.filters} ref={filterBar}>
      <FilterDropdown
        label="Set"
        options={setOptions}
        selected={filters.selectedSets}
        selectionLabel={filters.selectedSets.join(", ")}
        onToggle={set => {
          filters.toggleSelectedSet(set);
          setPageSize(CARD_PAGE_SIZE);
        }}
        onClear={() => {
          filters.clearSelectedSets();
          setPageSize(CARD_PAGE_SIZE);
        }}
      />
      {filterGroups.slice(0, 2).map(group => <FilterDropdown
        key={group.label}
        label={group.label}
        options={[...new Set([...group.values, ...group.selected])].map(value => ({ value, label: value }))}
        selected={group.selected}
        optionsClassName={group.optionsClassName}
        onToggle={value => {
          group.set(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
          setPageSize(CARD_PAGE_SIZE);
        }}
        onClear={() => {
          group.set([]);
          setPageSize(CARD_PAGE_SIZE);
        }}
      />)}
      <button className={styles.reset} onClick={() => { filters.clearFilters(); setPageSize(CARD_PAGE_SIZE); }}>Reset filters</button>
    </div>
    {advanced && <div className={styles.advanced}>{filterGroups.slice(2).map(group => <div key={group.label}><span>{group.label}</span><div>{group.values.length === 0 ? <small>No options</small> : group.values.map(value => <button key={value} aria-pressed={group.selected.includes(value)} className={group.selected.includes(value) ? styles.activeChip : ""} onClick={() => group.set(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value])}>{value}</button>)}</div></div>)}</div>}
    <div className={styles.results}>
      <span aria-live="polite">{loading ? "Loading cards…" : `${filtered.length} cards`}</span>
      <label className={styles.dropdownField}>
        <span className={styles.dropdownLabel}>Sort by</span>
        <span className={styles.selectShell}>
          <select className={`${styles.dropdownControl} ${styles.nativeSelect}`} aria-label="Sort cards" value={sort} onChange={event => setSort(event.target.value)}>
            <option value="cost">Cost, then name</option>
            <option value="name">Name</option>
          </select>
        </span>
      </label>
    </div>
    {error ? <div className={styles.empty} role="alert">{error}</div> : !loading && filtered.length === 0 ? <div className={styles.empty}><ArchiveIcon name="search" size={30} /><h3>No cards found</h3><p>Try a different search or reset your filters.</p><button onClick={filters.clearFilters}>Reset filters</button></div> : <div className={gridStyle ? `${resultsLayout} ${styles.zoomGrid}` : resultsLayout} style={gridStyle}>{filtered.slice(0, pageSize).map(card => {
      const cardDestinations = destinations?.(card) ?? [];
      const assigned = cardDestinations.filter(target => target.quantity > 0);
      const addable = cardDestinations.filter(target => !target.disabledReason);
      const [home, sideboard] = cardDestinations;
      const addTarget = addable[0];
      const removeTarget = home?.full && sideboard?.quantity ? sideboard : assigned[0];
      return <article
        className={`${styles.card} ${assigned.length ? styles.selected : ""}`}
        key={card.id}
        onDragStartCapture={onAdd ? event => event.preventDefault() : undefined}
      >
        <CollectionCardArt card={card} destinations={addable.map(target => target.section)} quantities={assigned} viewMode={viewMode} onOpenCard={onOpenCard} />
        <button className={styles.cardName} onClick={() => onOpenCard(card)} title={card.name}>{card.name}</button>
        <div className={styles.cardMeta}><span>{onAdd && cardDestinations[0]?.section === "persona" ? `${card.type} · Persona` : card.type}</span><span>{card.cost || "—"} cost</span></div>
        {onAdd && cardDestinations.length > 0 && <div className={styles.cardActions}>
          <div className={styles.quantity}>
            <button type="button" aria-label={`Remove ${card.name}`}
              disabled={!onRemove || !removeTarget} onClick={() => { if (removeTarget) onRemove?.(removeTarget.section, card); }}>−</button>
            <span aria-live="polite" aria-label={assigned.map(target => `${target.quantity} ${quantityLabels[target.section]}`).join(", ") || "0 copies"}>
              {viewMode === "list" && assigned.length ? assigned.map(target => <span key={target.section}>{target.quantity} {quantityLabels[target.section]}</span>)
                : assigned.reduce((total, target) => total + target.quantity, 0)}
            </span>
            <button type="button" aria-label={`Add ${card.name}`}
              disabled={!addTarget} title={addTarget ? undefined : home?.disabledReason}
              onClick={() => { if (addTarget) onAdd(addTarget.section, card); }}>+</button>
          </div>
        </div>}
      </article>;
    })}</div>}
    {showLoadTrigger && <div ref={loadMoreTrigger} className={styles.loadMoreTrigger} aria-hidden="true" />}
    {hasMore && !canAutoLoad && <button className={styles.loadMore} onClick={() => setPageSize(size => size + CARD_PAGE_SIZE)}>Show more cards ({filtered.length - pageSize} remaining)</button>}
  </div>;
}
